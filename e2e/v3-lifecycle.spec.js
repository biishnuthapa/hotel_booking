const { test, expect } = require('@playwright/test')
const { ethers } = require('ethers')
const fs = require('fs')
const path = require('path')

const DAY = 86_400
const artifact = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'artifacts', 'contracts', 'HospitalityBooking.sol', 'HospitalityBooking.json')
  )
)
const registryArtifact = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'artifacts', 'contracts', 'ReviewRegistry.sol', 'ReviewRegistry.json')
  )
)
const tokenArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'artifacts', 'contracts', 'MockUSDC.sol', 'MockUSDC.json'))
)
const deployment = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'contracts', 'deployments', '31337.json'))
)

test('V3 local chain covers booking, check-in, withdrawals, terminal paths, review, and dispute', async () => {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:9545')
  const admin = await provider.getSigner(0)
  const host = await provider.getSigner(1)
  const guest = await provider.getSigner(2)
  const guestAddress = await guest.getAddress()
  const booking = new ethers.Contract(deployment.contracts.HospitalityBooking, artifact.abi, provider)
  const registry = new ethers.Contract(deployment.contracts.ReviewRegistry, registryArtifact.abi, provider)
  const token = new ethers.Contract(deployment.contracts.paymentToken, tokenArtifact.abi, provider)

  await (await booking.connect(host).createListing('E2E Hotel', 'ipfs://listing', 'ipfs://image', 5, 0, 0)).wait()
  await (await booking.connect(host).addRoomType(1, 'Suite', 'ipfs://room', 100_000_000n, 3)).wait()
  await (await token.connect(admin).mint(guestAddress, 10_000_000_000n)).wait()
  await (await token.connect(guest).approve(await booking.getAddress(), ethers.MaxUint256)).wait()

  const latest = await provider.getBlock('latest')
  let checkInDay = Math.floor(Number(latest.timestamp) / DAY) + 2
  await (await booking.connect(guest).book(1, 1, 1, checkInDay, checkInDay + 2)).wait()
  const first = await booking.getBooking(1)
  const domain = {
    name: 'HospitalityBooking',
    version: '1',
    chainId: 31337,
    verifyingContract: await booking.getAddress(),
  }
  const types = {
    CheckInAuthorization: [
      { name: 'bookingId', type: 'uint256' },
      { name: 'guest', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'validAfter', type: 'uint64' },
      { name: 'validUntil', type: 'uint64' },
    ],
  }
  const authorization = {
    bookingId: 1n,
    guest: guestAddress,
    nonce: 0n,
    validAfter: first.scheduledCheckIn,
    validUntil: first.checkInDeadline,
  }
  const signature = await host.signTypedData(domain, types, authorization)
  await provider.send('evm_setNextBlockTimestamp', [Number(first.scheduledCheckIn)])
  await (await booking.connect(guest).checkInAttested(
    1,
    first.scheduledCheckIn,
    first.checkInDeadline,
    0,
    signature
  )).wait()
  expect(Number((await booking.getBooking(1)).status)).toBe(2)
  await (await booking.connect(guest).withdraw()).wait()
  const reviewHash = ethers.keccak256(ethers.toUtf8Bytes('{"review":"great"}'))
  await (await registry.connect(guest).submitReview(1, 5, 'ipfs://review', reviewHash)).wait()
  await provider.send('evm_setNextBlockTimestamp', [Number(first.scheduledCheckout + 86_401n)])
  await (await booking.connect(guest).completeStay(1)).wait()
  await (await booking.connect(host).withdraw()).wait()

  const now = await provider.getBlock('latest')
  checkInDay = Math.floor(Number(now.timestamp) / DAY) + 3
  await (await booking.connect(guest).book(1, 1, 1, checkInDay, checkInDay + 1)).wait()
  await (await booking.connect(guest).cancelBooking(2)).wait()
  expect(Number((await booking.getBooking(2)).status)).toBe(1)

  await (await booking.connect(guest).book(1, 1, 1, checkInDay + 2, checkInDay + 3)).wait()
  const noShow = await booking.getBooking(3)
  await provider.send('evm_setNextBlockTimestamp', [Number(noShow.checkInDeadline + 1n)])
  await (await booking.connect(admin).settleNoShow(3)).wait()
  expect(Number((await booking.getBooking(3)).status)).toBe(4)

  const later = await provider.getBlock('latest')
  const disputeDay = Math.floor(Number(later.timestamp) / DAY) + 3
  await (await booking.connect(guest).book(1, 1, 1, disputeDay, disputeDay + 1)).wait()
  const disputed = await booking.getBooking(4)
  const bond = (disputed.escrowedAmount * BigInt(deployment.parameters.disputeBondBps) + 9_999n) / 10_000n
  await (await token.connect(guest).approve(await booking.getAddress(), bond)).wait()
  await (await booking.connect(guest).openDispute(4, ethers.id('evidence'))).wait()
  await (await booking.connect(admin).resolveDispute(4, 0, ethers.id('reason'))).wait()
  expect(Number((await booking.getBooking(4)).status)).toBe(6)
  expect(await token.balanceOf(await booking.getAddress())).toBeGreaterThanOrEqual(
    await booking.liabilityBalance()
  )
})

test('UI defaults to V3 and separates legacy records', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('HospitalityBooking V3').first()).toBeVisible()
  await page.goto('/legacy')
  await expect(page.getByText(/Legacy V1 · read only/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /book/i })).toHaveCount(0)
})
