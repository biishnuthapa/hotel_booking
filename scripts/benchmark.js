/**
 * Gas + attacker-cost benchmark for the HospitalityBooking system.
 *
 * Produces two tables for the paper:
 *   1. Per-operation gas and fiat cost under explicit fee scenarios.
 *   2. The cost of one fabricated verified review, with and without the
 *      ReviewRegistry mechanism.
 *
 * Usage:  npx hardhat run scripts/benchmark.js
 * Output: benchmarks/benchmark-<network>-<timestamp>.json and benchmark-latest.md
 */
const fs = require('fs')
const path = require('path')
const { ethers, network } = require('hardhat')

const DAY = 86_400
const BPS = 10_000n
const PRICE = 150_000_000n // 150 USDC/night, 6 decimals
const TAX_BPS = 700n
const DEPOSIT_BPS = 500n
const DISPUTE_BOND_BPS = 200n
const ELIGIBILITY_BPS = 5_000
const SATURATION_BPS = 10_000
const REPEAT_WEIGHT_BPS = 2_500
const UNATTESTED_WEIGHT_BPS = 5_000

const URI = 'ipfs://bafyreigh2akiscaildcexampleexampleexampleexample'
const HASH = ethers.keccak256(ethers.toUtf8Bytes('review'))

// Fee scenarios. Gas price in gwei, native token price in USD.
const SCENARIOS = [
  { name: 'Ethereum L1', gwei: 20, usd: 3000 },
  { name: 'Polygon PoS', gwei: 30, usd: 0.4 },
  { name: 'Arbitrum One', gwei: 0.1, usd: 3000 },
]

const results = {}

function record(label, receipt) {
  const gas = Number(receipt.gasUsed)
  if (!results[label]) results[label] = []
  results[label].push(gas)
  return gas
}

function fiat(gas, { gwei, usd }) {
  return (gas * gwei * 1e-9 * usd).toFixed(gwei < 1 ? 6 : 4)
}

async function setNextTimestamp(ts) {
  await network.provider.send('evm_setNextBlockTimestamp', [Number(ts)])
}

async function main() {
  const [admin, treasury, pauser, arbitrator, host, guest, guest2] = await ethers.getSigners()

  const token = await ethers.deployContract('MockUSDC')
  await token.waitForDeployment()

  const booking = await ethers.deployContract('HospitalityBooking', [
    await token.getAddress(), treasury.address,
    Number(TAX_BPS), Number(DEPOSIT_BPS), Number(DISPUTE_BOND_BPS),
    admin.address, pauser.address, arbitrator.address,
  ])
  await booking.waitForDeployment()
  record('deploy core', await booking.deploymentTransaction().wait())

  const registry = await ethers.deployContract('ReviewRegistry', [
    await booking.getAddress(), ELIGIBILITY_BPS, SATURATION_BPS, REPEAT_WEIGHT_BPS,
    UNATTESTED_WEIGHT_BPS,
  ])
  await registry.waitForDeployment()
  record('deploy review registry', await registry.deploymentTransaction().wait())

  const lens = await ethers.deployContract('BookingLens', [
    await booking.getAddress(), await registry.getAddress(),
  ])
  await lens.waitForDeployment()
  record('deploy lens', await lens.deploymentTransaction().wait())

  for (const who of [guest, guest2, host]) await token.mint(who.address, 10n ** 12n)

  record('createListing', await (await booking.connect(host)
    .createListing('Hotel', 'ipfs://listing', 'ipfs://image', 40, 0, 0)).wait())
  record('addRoomType', await (await booking.connect(host)
    .addRoomType(1, 'Suite', 'ipfs://room', PRICE, 10)).wait())

  const blk = await ethers.provider.getBlock('latest')
  let day = Math.floor(Number(blk.timestamp) / DAY) + 2

  async function bookStay(signer, nights, label) {
    const base = PRICE * BigInt(nights)
    const total = base + (base * DEPOSIT_BPS) / BPS
    await (await token.connect(signer).approve(await booking.getAddress(), total)).wait()
    const rc = await (await booking.connect(signer).book(1, 1, 1, day, day + nights)).wait()
    if (label) record(label, rc)
    const id = await booking.totalBookings()
    day += nights + 2
    return id
  }

  async function checkIn(id, signer) {
    const rec = await booking.getBooking(id)
    const net = await ethers.provider.getNetwork()
    const sig = await host.signTypedData(
      { name: 'HospitalityBooking', version: '1', chainId: net.chainId, verifyingContract: await booking.getAddress() },
      { CheckInAuthorization: [
        { name: 'bookingId', type: 'uint256' }, { name: 'guest', type: 'address' },
        { name: 'nonce', type: 'uint256' }, { name: 'validAfter', type: 'uint64' },
        { name: 'validUntil', type: 'uint64' }] },
      { bookingId: id, guest: rec.guest, nonce: rec.authorizationNonce,
        validAfter: rec.scheduledCheckIn, validUntil: rec.checkInDeadline }
    )
    await setNextTimestamp(rec.scheduledCheckIn)
    return (await booking.connect(signer)
      .checkInAttested(id, rec.scheduledCheckIn, rec.checkInDeadline, rec.authorizationNonce, sig)).wait()
  }

  // --- Guest lifecycle ------------------------------------------------------
  const b1 = await bookStay(guest, 1, 'book (1 night)')
  await bookStay(guest, 3, 'book (3 nights)')
  await bookStay(guest, 7, 'book (7 nights)')

  record('checkIn (host-attested)', await checkIn(b1, guest))
  record('submitReview', await (await registry.connect(guest).submitReview(b1, 5, URI, HASH)).wait())

  const rec1 = await booking.getBooking(b1)
  await setNextTimestamp(BigInt(rec1.scheduledCheckout) + 86_401n)
  record('completeStay', await (await booking.completeStay(b1)).wait())
  record('withdraw', await (await booking.connect(host).withdraw()).wait())

  // Cancellation
  const b2 = await bookStay(guest, 2)
  record('cancelBooking', await (await booking.connect(guest).cancelBooking(b2)).wait())

  // No-show
  const b3 = await bookStay(guest, 1)
  const rec3 = await booking.getBooking(b3)
  await setNextTimestamp(BigInt(rec3.checkInDeadline) + 1n)
  record('settleNoShow', await (await booking.settleNoShow(b3)).wait())

  // Dispute
  const b4 = await bookStay(guest, 1)
  const rec4 = await booking.getBooking(b4)
  const bond = (rec4.escrowedAmount * DISPUTE_BOND_BPS + BPS - 1n) / BPS
  await (await token.connect(guest).approve(await booking.getAddress(), bond)).wait()
  record('openDispute', await (await booking.connect(guest)
    .openDispute(b4, ethers.keccak256(ethers.toUtf8Bytes('evidence')))).wait())
  record('resolveDispute', await (await booking.connect(arbitrator)
    .resolveDispute(b4, 1, ethers.keccak256(ethers.toUtf8Bytes('reason')))).wait())

  // tokenURI read cost
  results['tokenURI (view)'] = [Number(await booking.tokenURI.estimateGas(rec1.tokenId))]

  // --- Attacker cost model --------------------------------------------------
  // What does one fabricated *counted* review cost the host?
  const reference = PRICE // one night, one room
  const floor = (reference * BigInt(ELIGIBILITY_BPS)) / BPS
  const taxOnFloor = (floor * TAX_BPS) / BPS
  const taxOnMinimum = 1n // a 1-unit room type: tax rounds to zero, so gas dominates

  const attack = {
    withoutMechanism: {
      note: 'Host adds a 1-unit room type, self-books, self-attests check-in, reviews.',
      bookingValueAtomic: taxOnMinimum.toString(),
      nonRefundableTaxAtomic: '0',
      countedWeightBps: 10000,
    },
    withMechanism: {
      note: 'R1 forces the booking to clear the listing-relative floor; R3a then zeroes a self-booking outright, so the host must use a distinct wallet and forfeit tax on a real-value booking.',
      minimumBookingValueAtomic: floor.toString(),
      nonRefundableTaxAtomic: taxOnFloor.toString(),
      countedWeightBps: 10000,
    },
    ratio: Number(taxOnFloor) / 1,
  }

  // --- Emit -----------------------------------------------------------------
  const rows = Object.entries(results).map(([op, samples]) => {
    const mean = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
    return {
      operation: op,
      gasMean: mean,
      gasMin: Math.min(...samples),
      gasMax: Math.max(...samples),
      fiat: Object.fromEntries(SCENARIOS.map((s) => [s.name, fiat(mean, s)])),
    }
  })

  const sizes = {}
  for (const name of ['HospitalityBooking', 'ReviewRegistry', 'BookingLens', 'HospitalityBookingMetadata']) {
    const art = await hre.artifacts.readArtifact(name)
    sizes[name] = (art.deployedBytecode.length - 2) / 2
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const out = { network: network.name, generatedAt: new Date().toISOString(), scenarios: SCENARIOS, sizes, rows, attack }
  const dir = path.join(__dirname, '..', 'benchmarks')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `benchmark-${network.name}-${stamp}.json`), JSON.stringify(out, null, 2))

  let md = `# Gas benchmark — HospitalityBooking\n\nNetwork: ${network.name} · Generated: ${out.generatedAt}\n\n`
  md += `## Runtime sizes (EVM limit 24,576 bytes)\n\n| Contract | Bytes |\n|---|---|\n`
  for (const [k, v] of Object.entries(sizes)) md += `| ${k} | ${v.toLocaleString()} |\n`
  md += `\n## Per-operation gas\n\n| Operation | Gas (mean) | ${SCENARIOS.map((s) => `${s.name} (${s.gwei} gwei)`).join(' | ')} |\n|---|---|${SCENARIOS.map(() => '---').join('|')}|\n`
  for (const r of rows) {
    md += `| ${r.operation} | ${r.gasMean.toLocaleString()} | ${SCENARIOS.map((s) => `$${r.fiat[s.name]}`).join(' | ')} |\n`
  }
  md += `\n## Cost of one fabricated counted review\n\n`
  md += `| | Booking value required | Non-refundable tax | Counted weight |\n|---|---|---|---|\n`
  md += `| Without mechanism | 1 atomic unit | 0 | 100% |\n`
  md += `| With mechanism | ${(Number(floor) / 1e6).toFixed(2)} USDC | ${(Number(taxOnFloor) / 1e6).toFixed(2)} USDC | 100% (0% if self-booked) |\n`
  fs.writeFileSync(path.join(dir, 'benchmark-latest.md'), md)
  console.log(md)
}

const hre = require('hardhat')
main().catch((e) => { console.error(e); process.exit(1) })
