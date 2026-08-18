/**
 * End-to-end multi-role logic verification on a live network.
 *
 * Three distinct roles on real addresses so fund flows are visible on-chain:
 *   ADMIN  = deployer = contract owner() = platform (collects tax)
 *   HOST   = apartment owner (receives payout, collateral)
 *   TENANT = guest (pays, checks in, refunds, reviews)
 *
 * ADMIN funds fresh HOST and TENANT wallets, then we drive the full lifecycle
 * and record: NFT tokenURI status at each transition, contract balance, and
 * each party's balance delta, plus every tx hash. Residual funds are swept
 * back to ADMIN at the end.
 *
 * Run: npx hardhat run scripts/verify-amoy.js --network amoy
 * Output: scripts/verify-amoy-result.json
 */
const { ethers, network } = require('hardhat')
const fs = require('fs')
const path = require('path')

const TAX_PERCENT = 7
const SECURITY_FEE = 5
const GAS = { gasPrice: 30_000_000_000n } // 30 gwei; Amoy base fee ~0
const PRICE = ethers.parseEther('0.0002') // per night
const NFT_IMAGE = 'https://gateway.pinata.cloud/ipfs/Qmdu2cdztFaixe6SkHDSfnRGbetmzWx75Jrn8a7r9hSVZU'
const NFT_META = 'ipfs://Qma6WCRpW4QCJkMCrkx4bk6qmVmnbft92N4VWgSxChTEzq'

const STATUS_NAME = { 0: 'Booked', 1: 'Cancelled', 2: 'CheckedIn', 3: 'Expired' }
const fmt = (wei) => ethers.formatEther(wei)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const explorer = 'https://amoy.polygonscan.com'
  const [admin] = await ethers.getSigners()
  const provider = admin.provider
  const chainId = (await provider.getNetwork()).chainId
  if (chainId !== 80002n) throw new Error(`Expected Amoy (80002), got ${chainId}`)

  // Fresh host + tenant wallets
  const host = ethers.Wallet.createRandom().connect(provider)
  const tenant = ethers.Wallet.createRandom().connect(provider)

  const report = { network: network.name, chainId: chainId.toString(), roles: {}, steps: [], funds: [], nft: [], txs: {} }
  report.roles = { admin: admin.address, host: host.address, tenant: tenant.address }

  const log = (msg) => { console.log(msg); report.steps.push(msg) }
  const bal = async (a) => provider.getBalance(a)

  const snapshot = async (label, contractAddr) => {
    const row = {
      label,
      admin: fmt(await bal(admin.address)),
      host: fmt(await bal(host.address)),
      tenant: fmt(await bal(tenant.address)),
      contract: contractAddr ? fmt(await bal(contractAddr)) : null,
    }
    report.funds.push(row)
    return row
  }

  const nftStatus = async (contract, tokenId, at) => {
    let status = 'burned/nonexistent'
    try {
      const uri = await contract.tokenURI(tokenId)
      const json = JSON.parse(Buffer.from(uri.split('base64,')[1], 'base64').toString('utf8'))
      const attrs = Object.fromEntries(json.attributes.map((a) => [a.trait_type, a.value]))
      status = `${attrs.Status} (${STATUS_NAME[attrs.Status]})`
    } catch (_) {}
    const entry = { at, tokenId: tokenId.toString(), status }
    report.nft.push(entry)
    log(`   NFT #${tokenId} @ ${at}: ${status}`)
    return status
  }

  log(`ADMIN  ${admin.address}`)
  log(`HOST   ${host.address}`)
  log(`TENANT ${tenant.address}`)
  log(`Admin balance: ${fmt(await bal(admin.address))} POL\n`)

  // ---- Fund host + tenant ----
  log('Funding host (0.06) and tenant (0.06) from admin...')
  await (await admin.sendTransaction({ to: host.address, value: ethers.parseEther('0.06'), ...GAS })).wait()
  await (await admin.sendTransaction({ to: tenant.address, value: ethers.parseEther('0.06'), ...GAS })).wait()

  // ---- Deploy (ADMIN = platform owner) ----
  log('ADMIN deploys contract...')
  const Factory = await ethers.getContractFactory('HospitalityBookingNFT', admin)
  const contract = await Factory.deploy(TAX_PERCENT, SECURITY_FEE, GAS)
  await contract.waitForDeployment()
  const addr = await contract.getAddress()
  report.contract = addr
  report.links = { contract: `${explorer}/address/${addr}` }
  log(`   deployed at ${addr} (owner/platform = ${admin.address})`)

  const asHost = contract.connect(host)
  const asTenant = contract.connect(tenant)

  // ---- HOST creates apartment + room type ----
  log('HOST creates apartment...')
  let tx = await asHost.createAppartment(
    'Verification Apartment', 'E2E logic test listing', 'Laramie, Wyoming',
    NFT_IMAGE, 4, '41.31', '-105.59', NFT_META, 'Stay Pass', 'Proof of stay', NFT_IMAGE, GAS
  )
  report.txs.createApartment = (await tx.wait()).hash
  const aid = 1

  log('HOST adds room type (capacity 3)...')
  tx = await asHost.addRoomTypeToApartment(aid, 'Deluxe Double', 'Two queens', PRICE, NFT_IMAGE, 3, GAS)
  report.txs.addRoomType = (await tx.wait()).hash

  // ---- Dates ----
  const now = Number((await provider.getBlock('latest')).timestamp)
  const soon = now + 120                 // for check-in (A) and no-show (C)
  const far = now + 12 * 24 * 60 * 60     // for refund (B)
  const cost = (nights) => {
    const total = PRICE * BigInt(nights)
    return total + (total * BigInt(SECURITY_FEE)) / 100n
  }

  await snapshot('after setup (pre-bookings)', addr)

  // ---- TENANT makes 3 bookings ----
  log('TENANT books A (check-in scenario, date ~120s out)...')
  tx = await asTenant.bookApartment(aid, 0, 1, [soon], { value: cost(1), ...GAS })
  report.txs.bookA = (await tx.wait()).hash
  log('TENANT books B (refund scenario, far-future date)...')
  tx = await asTenant.bookApartment(aid, 0, 1, [far], { value: cost(1), ...GAS })
  report.txs.bookB = (await tx.wait()).hash
  log('TENANT books C (no-show scenario, date ~120s out)...')
  tx = await asTenant.bookApartment(aid, 0, 1, [soon], { value: cost(1), ...GAS })
  report.txs.bookC = (await tx.wait()).hash

  const bookings = await contract.getBookings(aid)
  const tokenA = bookings[0].tokenId, tokenB = bookings[1].tokenId, tokenC = bookings[2].tokenId
  report.tokens = { A: tokenA.toString(), B: tokenB.toString(), C: tokenC.toString() }

  log('NFT statuses right after booking (expect all Booked=0):')
  await nftStatus(contract, tokenA, 'A after book')
  await nftStatus(contract, tokenB, 'B after book')
  await nftStatus(contract, tokenC, 'C after book')
  await snapshot('after 3 bookings (contract holds escrow)', addr)

  // ---- REFUND B (before stay) ----
  log('TENANT refunds B (cancellation before stay)...')
  const beforeRefund = { host: await bal(host.address), admin: await bal(admin.address), contract: await bal(addr) }
  tx = await asTenant.refundBooking(aid, 1, GAS)
  report.txs.refundB = (await tx.wait()).hash
  const afterRefund = { host: await bal(host.address), admin: await bal(admin.address), contract: await bal(addr) }
  report.refundFlow = {
    hostReceived: fmt(afterRefund.host - beforeRefund.host),
    adminReceived: fmt(afterRefund.admin - beforeRefund.admin),
    contractDelta: fmt(afterRefund.contract - beforeRefund.contract),
    note: 'tenant refunded full price; security fee split half host / half admin as collateral',
  }
  await nftStatus(contract, tokenB, 'B after refund (expect burned)')
  await snapshot('after refund B', addr)

  // ---- Wait for check-in window ----
  const waitMs = (soon - Number((await provider.getBlock('latest')).timestamp) + 8) * 1000
  if (waitMs > 0) { log(`Waiting ~${Math.ceil(waitMs / 1000)}s for stay dates to arrive...`); await sleep(waitMs) }

  // ---- CHECK-IN A (fund split) ----
  log('TENANT checks in A...')
  const beforeCI = { host: await bal(host.address), admin: await bal(admin.address), contract: await bal(addr) }
  tx = await asTenant.checkInApartment(aid, 0, GAS)
  report.txs.checkInA = (await tx.wait()).hash
  const afterCI = { host: await bal(host.address), admin: await bal(admin.address), contract: await bal(addr) }
  report.checkInFlow = {
    hostReceived: fmt(afterCI.host - beforeCI.host),
    adminReceived: fmt(afterCI.admin - beforeCI.admin),
    contractDelta: fmt(afterCI.contract - beforeCI.contract),
    note: 'host gets price - tax; admin gets tax; tenant gets security fee back (minus own gas)',
  }
  await nftStatus(contract, tokenA, 'A after check-in (expect CheckedIn=2)')

  // ---- REVIEW (tenant now eligible) ----
  log('TENANT adds review (allowed only after check-in)...')
  tx = await asTenant.addReview(aid, 'Smooth on-chain check-in, great stay.', GAS)
  report.txs.addReview = (await tx.wait()).hash
  const reviews = await contract.getReviews(aid)
  report.reviewCount = reviews.length

  // ---- NO-SHOW CLAIM C (fund split) ----
  log('HOST claims funds on C (tenant no-show)...')
  const beforeClaim = { host: await bal(host.address), admin: await bal(admin.address), contract: await bal(addr) }
  tx = await asHost.claimFunds(aid, 2, GAS)
  report.txs.claimC = (await tx.wait()).hash
  const afterClaim = { host: await bal(host.address), admin: await bal(admin.address), contract: await bal(addr) }
  report.claimFlow = {
    adminReceived: fmt(afterClaim.admin - beforeClaim.admin),
    contractDelta: fmt(afterClaim.contract - beforeClaim.contract),
    note: 'host claims price - tax + full security fee; admin gets tax (host delta offset by gas it paid)',
  }
  await nftStatus(contract, tokenC, 'C after no-show claim (expect Expired=3)')

  // ---- CHECKOUT A ----
  log('HOST checks out A...')
  tx = await asHost.checkout(aid, 0, GAS)
  report.txs.checkoutA = (await tx.wait()).hash
  await nftStatus(contract, tokenA, 'A after checkout (expect Expired=3)')

  await snapshot('final (contract should be empty)', addr)
  report.contractFinalBalance = fmt(await bal(addr))

  // ---- Sweep residual back to admin ----
  log('Sweeping residual host/tenant funds back to admin...')
  for (const w of [host, tenant]) {
    const b = await bal(w.address)
    const fee = 21000n * GAS.gasPrice
    if (b > fee) {
      try { await (await w.sendTransaction({ to: admin.address, value: b - fee, ...GAS })).wait() } catch (_) {}
    }
  }
  report.adminFinalBalance = fmt(await bal(admin.address))

  report.links.bookA = `${explorer}/tx/${report.txs.bookA}`
  report.links.checkInA = `${explorer}/tx/${report.txs.checkInA}`
  report.links.refundB = `${explorer}/tx/${report.txs.refundB}`
  report.links.claimC = `${explorer}/tx/${report.txs.claimC}`

  fs.writeFileSync(path.join(__dirname, 'verify-amoy-result.json'), JSON.stringify(report, null, 2))
  log('\nSaved scripts/verify-amoy-result.json')
  console.log(JSON.stringify({
    contract: addr, tokens: report.tokens,
    checkInFlow: report.checkInFlow, refundFlow: report.refundFlow, claimFlow: report.claimFlow,
    contractFinalBalance: report.contractFinalBalance,
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
