/**
 * End-to-end lifecycle capture on a public network.
 *
 * Deploys nothing — point it at an existing deployment — then exercises every
 * settlement path across three distinct wallets and prints a Markdown table of
 * confirmed transactions for the paper's appendix.
 *
 *   npx hardhat run scripts/amoy-lifecycle.js --network amoy
 *
 * Requires DEPLOYER_PRIVATE_KEY in .env plus a deployment file at
 * contracts/deployments/<chainId>.json (written by scripts/deploy.js).
 *
 * The host and guest wallets are generated fresh, funded from the deployer,
 * and swept back at the end, so only the deployer key is ever needed.
 */
const fs = require('fs')
const path = require('path')
const { ethers, network } = require('hardhat')

const DAY = 86_400
const FUND = ethers.parseEther(process.env.LIFECYCLE_FUND_POL || '0.05')
const txs = []

function note(label, receipt) {
  txs.push({ label, hash: receipt.hash, gas: Number(receipt.gasUsed), block: receipt.blockNumber })
  console.log(`  ${label.padEnd(34)} ${receipt.hash}  gas ${receipt.gasUsed}`)
  return receipt
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId)
  const file = path.join(__dirname, '..', 'contracts', 'deployments', `${chainId}.json`)
  if (!fs.existsSync(file)) throw new Error(`No deployment for chain ${chainId}. Run scripts/deploy.js first.`)
  const deployment = JSON.parse(fs.readFileSync(file, 'utf8'))
  const { HospitalityBooking, ReviewRegistry, paymentToken } = deployment.contracts

  const [deployer] = await ethers.getSigners()
  console.log(`network ${network.name}  deployer ${deployer.address}`)
  console.log(`booking ${HospitalityBooking}\nregistry ${ReviewRegistry}\ntoken   ${paymentToken}\n`)

  // Three distinct roles, as the paper claims.
  const host = ethers.Wallet.createRandom().connect(ethers.provider)
  const guest = ethers.Wallet.createRandom().connect(ethers.provider)
  console.log(`host  ${host.address}\nguest ${guest.address}\n`)

  for (const w of [host, guest]) {
    await (await deployer.sendTransaction({ to: w.address, value: FUND })).wait()
  }

  const booking = await ethers.getContractAt('HospitalityBooking', HospitalityBooking)
  const registry = await ethers.getContractAt('ReviewRegistry', ReviewRegistry)
  const token = await ethers.getContractAt('MockUSDC', paymentToken)

  const decimals = Number(await token.decimals())
  const price = ethers.parseUnits(process.env.LIFECYCLE_PRICE || '150', decimals)
  const deposit = (price * 500n) / 10_000n
  const total = price + deposit

  // Fund the guest with the payment token (MockUSDC on a testnet).
  await (await token.mint(guest.address, total * 4n)).wait()

  // Put check-in a few minutes out rather than at 00:00 UTC: the schedule
  // offset is minutes-from-midnight for the chosen epoch day, so we aim it at
  // "now + LEAD" and book that same day.
  const nowSec = Number((await ethers.provider.getBlock('latest')).timestamp)
  const LEAD = Number(process.env.LIFECYCLE_LEAD_MINUTES || 4)
  const checkInOffset = Math.floor((nowSec % DAY) / 60) + LEAD
  const checkOutOffset = Math.min(checkInOffset + 60, 2880)

  console.log('— listing —')
  console.log(`  check-in opens ~${LEAD} min from now (offset ${checkInOffset} min past midnight UTC)`)
  note('createListing', await (await booking.connect(host)
    .createListing('Amoy Demo Stay', 'ipfs://listing', 'ipfs://image', 5, checkInOffset, checkOutOffset)).wait())
  const listingId = await booking.totalListings()
  note('addRoomType', await (await booking.connect(host)
    .addRoomType(listingId, 'Suite', 'ipfs://room', price, 3)).wait())

  const checkInDay = Math.floor(nowSec / DAY)

  console.log('\n— booking and settlement —')
  await (await token.connect(guest).approve(HospitalityBooking, total)).wait()
  note('book (mints proof-of-stay NFT)', await (await booking.connect(guest)
    .book(listingId, await booking.totalRoomTypes(), 1, checkInDay, checkInDay + 1)).wait())
  const bookingId = await booking.totalBookings()

  const record = await booking.getBooking(bookingId)
  console.log(`  scheduled check-in at ${new Date(Number(record.scheduledCheckIn) * 1000).toISOString()}`)

  // Host signs the EIP-712 check-in authorization; the guest submits it.
  const signature = await host.signTypedData(
    { name: 'HospitalityBooking', version: '1', chainId, verifyingContract: HospitalityBooking },
    { CheckInAuthorization: [
      { name: 'bookingId', type: 'uint256' }, { name: 'guest', type: 'address' },
      { name: 'nonce', type: 'uint256' }, { name: 'validAfter', type: 'uint64' },
      { name: 'validUntil', type: 'uint64' }] },
    { bookingId, guest: guest.address, nonce: record.authorizationNonce,
      validAfter: record.scheduledCheckIn, validUntil: record.checkInDeadline }
  )

  let now = (await ethers.provider.getBlock('latest')).timestamp
  while (now < Number(record.scheduledCheckIn)) {
    const left = Number(record.scheduledCheckIn) - now
    console.log(`  waiting ${left}s for the check-in window…`)
    await wait(Math.min(left, 60) * 1000)
    now = (await ethers.provider.getBlock('latest')).timestamp
  }

  note('checkInAttested (host countersigned)', await (await booking.connect(guest)
    .checkInAttested(bookingId, record.scheduledCheckIn, record.checkInDeadline, record.authorizationNonce, signature)).wait())

  console.log('\n— review integrity —')
  const threshold = await registry.reviewEligibilityThreshold(listingId, 1, 1)
  console.log(`  eligibility threshold: ${ethers.formatUnits(threshold, decimals)} tokens`)
  note('submitReview', await (await registry.connect(guest)
    .submitReview(bookingId, 5, 'ipfs://bafyreiglobalreviewexampleexampleexample',
      ethers.keccak256(ethers.toUtf8Bytes('amoy-review')))).wait())
  const review = await registry.getReview(bookingId)
  console.log(`  assigned weight: ${Number(review.weightBps) / 100}%`)
  console.log(`  weighted rating: ${Number(await registry.weightedRating(listingId)) / 10000}`)
  console.log(`  raw rating:      ${Number(await registry.rawRating(listingId)) / 10000}`)

  console.log('\n— NFT state —')
  const uri = await booking.tokenURI(record.tokenId)
  const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString())
  console.log(`  ${json.name} → ${JSON.stringify(json.attributes.find((a) => a.trait_type === 'Status'))}`)

  console.log('\n— withdrawals —')
  const guestPending = await booking.pendingWithdrawals(guest.address)
  if (guestPending > 0n) note('withdraw (guest deposit)', await (await booking.connect(guest).withdraw()).wait())

  // Sweep the throwaway wallets back to the deployer.
  console.log('\n— sweep —')
  for (const w of [host, guest]) {
    const bal = await ethers.provider.getBalance(w.address)
    const fee = ethers.parseEther('0.002')
    if (bal > fee) {
      await (await w.sendTransaction({ to: deployer.address, value: bal - fee })).wait()
      console.log(`  swept ${ethers.formatEther(bal - fee)} POL from ${w.address}`)
    }
  }

  const explorer = chainId === 80002 ? 'https://amoy.polygonscan.com/tx/' : ''
  let md = `\n## Appendix A — on-chain evidence (${network.name}, chain ${chainId})\n\n`
  md += `Contracts: booking \`${HospitalityBooking}\`, review registry \`${ReviewRegistry}\`\n\n`
  md += `Roles: host \`${host.address}\`, guest \`${guest.address}\`, platform \`${deployer.address}\`\n\n`
  md += `| Step | Gas | Transaction |\n|---|---|---|\n`
  for (const t of txs) md += `| ${t.label} | ${t.gas.toLocaleString()} | [\`${t.hash.slice(0, 10)}…\`](${explorer}${t.hash}) |\n`
  fs.writeFileSync(path.join(__dirname, '..', 'benchmarks', `lifecycle-${chainId}.md`), md)
  console.log(md)
  console.log(`Saved benchmarks/lifecycle-${chainId}.md`)
}

main().catch((e) => { console.error(e); process.exit(1) })
