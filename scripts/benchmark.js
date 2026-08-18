/**
 * Gas / cost benchmark harness for HospitalityBookingNFT.
 *
 * Measures every state-changing operation across ITERATIONS full booking
 * lifecycles (create -> room type -> book 1/3/7 nights -> check-in ->
 * checkout / refund / no-show claim -> review) and reports min / mean / max
 * gas, plus fiat cost projections under configurable network fee scenarios.
 *
 * Also measures eth_estimateGas for the unbounded view functions
 * (getApartments, getOwnedTokens) as listing count grows, to quantify the
 * O(n) read-scaling limitation.
 *
 * Usage:
 *   npx hardhat run scripts/benchmark.js --network localhost   (or hardhat/amoy/bscTestnet)
 *
 * Output:
 *   artifacts/benchmarks/benchmark-<network>-<timestamp>.json
 *   artifacts/benchmarks/benchmark-latest.md   (paper-ready table)
 *
 * NOTE: deploys its own contract instance; never touches contracts/contractAddress.json.
 */
const { ethers, network } = require('hardhat')
const fs = require('fs')
const path = require('path')

const ITERATIONS = Number(process.env.BENCH_ITERATIONS || 5)
// BENCH_CONTRACT=V2 benchmarks the storage-optimized variant
const VARIANT = (process.env.BENCH_CONTRACT || 'V1').toUpperCase()
const CONTRACT_NAME = VARIANT === 'V2' ? 'HospitalityBookingNFTV2' : 'HospitalityBookingNFT'
const TAX_PERCENT = 7
const SECURITY_FEE = 5
const DAY = 24 * 60 * 60

// Fee scenarios for fiat projections (assumptions stated explicitly; update
// before camera-ready). gasPriceGwei * gasUsed * nativeUsd = USD cost.
const FEE_SCENARIOS = [
  { name: 'Ethereum L1 (20 gwei, ETH=$3000)', gasPriceGwei: 20, nativeUsd: 3000 },
  { name: 'Polygon PoS (30 gwei, POL=$0.40)', gasPriceGwei: 30, nativeUsd: 0.4 },
  { name: 'Arbitrum One (0.1 gwei, ETH=$3000)', gasPriceGwei: 0.1, nativeUsd: 3000 },
]

const toWei = (n) => ethers.parseEther(n.toString())

const stats = (values) => {
  const nums = values.map(Number)
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  return {
    n: nums.length,
    min: Math.min(...nums),
    mean: Math.round(mean),
    max: Math.max(...nums),
  }
}

async function main() {
  const signers = await ethers.getSigners()
  // On a public testnet only the configured PRIVATE_KEY is available, so one
  // account plays all roles. Role separation only matters for check-in / claim,
  // which are local-only (they need time travel) and skipped on testnets.
  const [deployer] = signers
  const host = signers[1] || deployer
  const tenant = signers[2] || deployer
  const chainId = (await deployer.provider.getNetwork()).chainId
  if (chainId === 137n || chainId === 1n) {
    throw new Error('Refusing to run benchmark on a mainnet. Use a testnet or localhost.')
  }
  const isLocal = network.name === 'hardhat' || network.name === 'localhost'

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const measurements = {} // label -> [gasUsed]
  const latencies = {} // label -> [ms]
  const record = async (label, txPromise) => {
    const started = Date.now()
    const tx = await txPromise
    const receipt = await tx.wait()
    const ms = Date.now() - started
    ;(measurements[label] ||= []).push(receipt.gasUsed.toString())
    ;(latencies[label] ||= []).push(ms)
    // Public testnet RPCs lag on nonce propagation; settle between txs.
    if (!isLocal) await sleep(2000)
    return receipt
  }

  // ---- Deployment ----
  const contract = await ethers.deployContract(CONTRACT_NAME, [
    TAX_PERCENT,
    SECURITY_FEE,
  ])
  await contract.waitForDeployment()
  const deployReceipt = await contract.deploymentTransaction().wait()
  measurements['deploy'] = [deployReceipt.gasUsed.toString()]

  const bookingCost = (priceEth, rooms, nights) => {
    // Multiply in wei (BigInt) to avoid JS float precision (e.g. 0.0001*3).
    const totalPrice = toWei(priceEth) * BigInt(rooms) * BigInt(nights)
    const fee = (totalPrice * BigInt(SECURITY_FEE)) / 100n
    return totalPrice + fee
  }

  const futureDates = async (count, offsetDays) => {
    const block = await ethers.provider.getBlock('latest')
    const start = Number(block.timestamp) + offsetDays * DAY
    return Array.from({ length: count }, (_, i) => start + i * DAY)
  }

  const timeTravelTo = async (ts) => {
    await network.provider.send('evm_setNextBlockTimestamp', [ts])
    await network.provider.send('evm_mine')
  }

  // Booking price only affects the ETH value locked per booking, not the gas
  // we measure. Keep it tiny on live testnets to avoid wasting faucet funds.
  const PRICE = Number(process.env.BENCH_PRICE || (isLocal ? 0.01 : 0.0001))

  // ---- Lifecycle iterations ----
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const aid = iter + 1

    if (VARIANT === 'V2') {
      await record(
        'createAppartment',
        contract
          .connect(host)
          .createAppartment(
            `Benchmark Apartment ${aid}`,
            'Laramie, Wyoming',
            'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            'ipfs://bafkreigh2akiscaildc6xv5n2xg2z2z6j5pkzuyit7w3gq2mmbt7xg4wzi',
            4
          )
      )
    } else {
      await record(
        'createAppartment',
        contract
          .connect(host)
          .createAppartment(
            `Benchmark Apartment ${aid}`,
            'Two-bedroom lakeside apartment with mountain views, used for gas benchmarking.',
            'Laramie, Wyoming',
            'https://example.com/a.jpg,https://example.com/b.jpg,https://example.com/c.jpg',
            4,
            '41.3114',
            '-105.5911',
            'ipfs://bafkreigh2akiscaildc6xv5n2xg2z2z6j5pkzuyit7w3gq2mmbt7xg4wzi',
            'Lakeside Stay Pass',
            'Proof-of-stay NFT minted for each booking of the Lakeside Apartment.',
            'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
          )
      )
    }

    await record(
      'addRoomTypeToApartment',
      contract
        .connect(host)
        .addRoomTypeToApartment(aid, 'Deluxe Double', 'Two queen beds', toWei(PRICE), 'https://example.com/room.jpg', 8)
    )

    // Booking size sweep: 1, 3, 7 nights
    const nightSweep = [1, 3, 7]
    const bookingIds = {}
    for (const nights of nightSweep) {
      const dates = await futureDates(nights, 2 + nights)
      const receipt = await record(
        `bookApartment (${nights} night${nights > 1 ? 's' : ''})`,
        contract
          .connect(tenant)
          .bookApartment(aid, 0, 1, dates, { value: bookingCost(PRICE, 1, nights) })
      )
      bookingIds[nights] = { id: (await contract.getBookings(aid)).length - 1, dates }
    }

    // tokenURI generation cost (view — estimateGas)
    const lastBooking = (await contract.getBookings(aid))[bookingIds[7].id]
    const uriGas = await contract.tokenURI.estimateGas(lastBooking.tokenId)
    ;(measurements['tokenURI (estimateGas, view)'] ||= []).push(uriGas.toString())

    // Refund the 3-night booking (pre-stay cancellation)
    await record(
      'refundBooking (3 nights)',
      contract.connect(tenant).refundBooking(aid, bookingIds[3].id)
    )

    if (isLocal) {
      // Check-in the 1-night booking
      await timeTravelTo(bookingIds[1].dates[0] + 60)
      await record(
        'checkInApartment',
        contract.connect(tenant).checkInApartment(aid, bookingIds[1].id)
      )
      await record('checkout', contract.connect(host).checkout(aid, bookingIds[1].id))
      await record('addReview', contract.connect(tenant).addReview(aid, 'Great stay, smooth on-chain check-in.'))

      // No-show claim on the 7-night booking
      await timeTravelTo(bookingIds[7].dates[0] + 25 * 60 * 60)
      await record('claimFunds (no-show)', contract.connect(host).claimFunds(aid, bookingIds[7].id))
    } else if (process.env.BENCH_LIVE_CHECKIN === '1') {
      // Live networks cannot time-travel: measure settlement ops with a real
      // near-future stay date and a real wait (~80s per iteration).
      const block = await ethers.provider.getBlock('latest')
      const liveDate = Number(block.timestamp) + 75
      await record(
        'bookApartment (live settle)',
        contract.connect(tenant).bookApartment(aid, 0, 1, [liveDate], { value: bookingCost(PRICE, 1, 1) })
      )
      const liveId = (await contract.getBookings(aid)).length - 1
      const waitMs = (liveDate + 5) * 1000 - Date.now()
      if (waitMs > 0) await sleep(waitMs)
      await record('checkInApartment', contract.connect(tenant).checkInApartment(aid, liveId))
      await record('checkout', contract.connect(host).checkout(aid, liveId))
      await record('addReview', contract.connect(tenant).addReview(aid, `Benchmark review iter ${iter}.`))
    }
  }

  // ---- Read-scaling sweep: getApartments / getOwnedTokens as N grows ----
  const readScaling = []
  if (isLocal) {
    const sweepContract = await ethers.deployContract(CONTRACT_NAME, [TAX_PERCENT, SECURITY_FEE])
    await sweepContract.waitForDeployment()
    const checkpoints = [1, 10, 25, 50, 100]
    let created = 0
    for (const target of checkpoints) {
      while (created < target) {
        created++
        if (VARIANT === 'V2') {
          await sweepContract
            .connect(host)
            .createAppartment(`Apt ${created}`, 'Laramie', 'ipfs://img', 'ipfs://meta', 2)
        } else {
          await sweepContract
            .connect(host)
            .createAppartment(
              `Apt ${created}`,
              'Scaling sweep apartment',
              'Laramie',
              'https://example.com/a.jpg',
              2,
              '0',
              '0',
              'ipfs://meta',
              'Pass',
              'Proof of stay',
              'ipfs://img'
            )
        }
      }
      // V1 reads everything at once; V2 reads one bounded page (25 items)
      const gas =
        VARIANT === 'V2'
          ? await sweepContract.getApartmentsPaged.estimateGas(0, 25)
          : await sweepContract.getApartments.estimateGas()
      readScaling.push({ apartments: target, getApartmentsEstimateGas: gas.toString() })
    }
  }

  // ---- Assemble report ----
  const opStats = Object.fromEntries(
    Object.entries(measurements).map(([label, vals]) => [label, stats(vals)])
  )
  const latencyStats = Object.fromEntries(
    Object.entries(latencies).map(([label, vals]) => [label, stats(vals)])
  )

  const fiatCosts = Object.fromEntries(
    Object.entries(opStats).map(([label, s]) => [
      label,
      FEE_SCENARIOS.map((sc) => ({
        scenario: sc.name,
        usd: +((s.mean * sc.gasPriceGwei * 1e-9) * sc.nativeUsd).toFixed(4),
      })),
    ])
  )

  const result = {
    contractVariant: `${CONTRACT_NAME} (${VARIANT})`,
    network: network.name,
    chainId: chainId.toString(),
    iterations: ITERATIONS,
    feeScenarios: FEE_SCENARIOS,
    gas: opStats,
    confirmLatencyMs: latencyStats,
    fiatCostUSD: fiatCosts,
    readScaling,
    generatedAt: new Date().toISOString(),
  }

  // NOTE: not under artifacts/ — hardhat cleans that directory on compile
  const outDir = path.join(__dirname, '..', 'benchmarks')
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(outDir, `benchmark-${VARIANT}-${network.name}-${stamp}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2))

  // Markdown table (paper-ready)
  let md = `# Gas benchmark — ${result.contractVariant}\n\n`
  md += `Network: ${network.name} (chainId ${chainId}) · Iterations: ${ITERATIONS} · Generated: ${result.generatedAt}\n\n`
  md += `| Operation | Gas (mean) | Gas (min–max) | ${FEE_SCENARIOS.map((s) => s.name).join(' | ')} |\n`
  md += `|---|---|---|${FEE_SCENARIOS.map(() => '---').join('|')}|\n`
  for (const [label, s] of Object.entries(opStats)) {
    const fiat = fiatCosts[label].map((f) => `$${f.usd}`).join(' | ')
    md += `| ${label} | ${s.mean.toLocaleString()} | ${s.min.toLocaleString()}–${s.max.toLocaleString()} | ${fiat} |\n`
  }
  if (readScaling.length) {
    md += `\n## Read scaling (unbounded loops)\n\n| Apartments | getApartments estimateGas |\n|---|---|\n`
    for (const r of readScaling) {
      md += `| ${r.apartments} | ${Number(r.getApartmentsEstimateGas).toLocaleString()} |\n`
    }
  }
  const mdPath = path.join(outDir, `benchmark-${VARIANT}-latest.md`)
  fs.writeFileSync(mdPath, md)

  console.log(md)
  console.log(`\nJSON: ${jsonPath}\nMarkdown: ${mdPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
