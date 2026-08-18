/**
 * Completes on-chain coverage of the transitions the multi-role run didn't
 * reach (review, check-in -> checkout -> Expired, no-show claim -> Expired).
 *
 * Reuses the already-deployed demo contract (single admin account holds every
 * role, so no fresh 0.16 POL deploy is needed). Idempotent-ish: it reuses any
 * existing Booked booking for the check-in path and books one fresh no-show.
 *
 * Uses EXPLICIT nonce management — the public Amoy RPC lags on back-to-back
 * sends, which caused a "nonce too low" collision when relying on auto-nonce.
 *
 * Run: npx hardhat run scripts/verify-amoy-finish.js --network amoy
 */
const { ethers } = require('hardhat')
const fs = require('fs')
const path = require('path')

const CONTRACT = '0x630dbDfa393bAd0c364E1AE559Cee5A6ED17768E'
const AID = 1
const GASPRICE = 30_000_000_000n
const PRICE = ethers.parseEther('0.0001')
const SECURITY_FEE = 5
const STATUS_NAME = { 0: 'Booked', 1: 'Cancelled', 2: 'CheckedIn', 3: 'Expired' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const explorer = 'https://amoy.polygonscan.com'

async function main() {
  const [admin] = await ethers.getSigners()
  const provider = admin.provider
  const c = await ethers.getContractAt('HospitalityBookingNFT', CONTRACT, admin)
  const out = { contract: CONTRACT, account: admin.address, transitions: [], txs: {} }

  // Manual nonce cursor to avoid RPC lag collisions.
  let nonce = await provider.getTransactionCount(admin.address, 'latest')
  const ov = () => ({ gasPrice: GASPRICE, nonce: nonce++ })

  const status = async (tokenId, at) => {
    let s = 'burned/nonexistent'
    try {
      const uri = await c.tokenURI(tokenId)
      const j = JSON.parse(Buffer.from(uri.split('base64,')[1], 'base64').toString('utf8'))
      const attrs = Object.fromEntries(j.attributes.map((a) => [a.trait_type, a.value]))
      s = `${attrs.Status} (${STATUS_NAME[attrs.Status]})`
    } catch (_) {}
    out.transitions.push({ at, tokenId: tokenId.toString(), status: s })
    console.log(`  NFT #${tokenId} @ ${at}: ${s}`)
    return s
  }

  const cost = PRICE + (PRICE * BigInt(SECURITY_FEE)) / 100n
  const bookings = await c.getBookings(AID)

  // Reuse an existing Booked booking (from the earlier partial run) for the
  // check-in path; otherwise book one.
  let idxD = bookings.findIndex((b) => Number(b.status) === 0)
  let tokenD
  if (idxD >= 0) {
    tokenD = bookings[idxD].tokenId
    console.log(`Reusing existing Booked booking #${idxD} (token ${tokenD}) for check-in path.`)
  } else {
    const now = Number((await provider.getBlock('latest')).timestamp)
    console.log('Booking D (check-in path)...')
    out.txs.bookD = (await (await c.bookApartment(AID, 0, 1, [now + 80], ov())).wait()).hash
    const bs = await c.getBookings(AID)
    idxD = bs.length - 1
    tokenD = bs[idxD].tokenId
  }

  // Fresh no-show booking E.
  const now2 = Number((await provider.getBlock('latest')).timestamp)
  const dateE = now2 + 90
  console.log('Booking E (no-show path)...')
  out.txs.bookE = (await (await c.bookApartment(AID, 0, 1, [dateE], { value: cost, ...ov() })).wait()).hash
  const bs2 = await c.getBookings(AID)
  const idxE = bs2.length - 1
  const tokenE = bs2[idxE].tokenId
  out.bookingIndexes = { D: idxD, E: idxE }
  out.tokens = { D: tokenD.toString(), E: tokenE.toString() }

  await status(tokenD, 'D before check-in')
  await status(tokenE, 'E after book')

  // Wait until both stay dates have arrived (dateD already past for reused D).
  const waitS = dateE - Number((await provider.getBlock('latest')).timestamp) + 8
  if (waitS > 0) { console.log(`Waiting ~${waitS}s for stay dates...`); await sleep(waitS * 1000) }

  console.log('Check-in D...')
  out.txs.checkInD = (await (await c.checkInApartment(AID, idxD, ov())).wait()).hash
  await status(tokenD, 'D after check-in (expect CheckedIn=2)')

  console.log('Add review (admin now checked in)...')
  out.txs.addReview = (await (await c.addReview(AID, 'On-chain verification review.', ov())).wait()).hash
  out.reviewCount = (await c.getReviews(AID)).length
  console.log(`  reviews now: ${out.reviewCount}`)

  console.log('Checkout D (CheckedIn -> Expired)...')
  out.txs.checkoutD = (await (await c.checkout(AID, idxD, ov())).wait()).hash
  await status(tokenD, 'D after checkout (expect Expired=3)')

  console.log('No-show claim E (Booked -> Expired)...')
  out.txs.claimE = (await (await c.claimFunds(AID, idxE, ov())).wait()).hash
  await status(tokenE, 'E after no-show claim (expect Expired=3)')

  out.links = {
    contract: `${explorer}/address/${CONTRACT}`,
    checkInD: `${explorer}/tx/${out.txs.checkInD}`,
    addReview: `${explorer}/tx/${out.txs.addReview}`,
    checkoutD: `${explorer}/tx/${out.txs.checkoutD}`,
    claimE: `${explorer}/tx/${out.txs.claimE}`,
  }
  fs.writeFileSync(path.join(__dirname, 'verify-amoy-finish-result.json'), JSON.stringify(out, null, 2))
  console.log('\nSaved scripts/verify-amoy-finish-result.json')
  console.log(`Remaining admin balance: ${ethers.formatEther(await provider.getBalance(admin.address))} POL`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
