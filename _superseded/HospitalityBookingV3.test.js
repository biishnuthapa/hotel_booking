const { expect } = require('chai')
const { ethers, network } = require('hardhat')

const DAY = 86_400
const PRICE = 100_000_001n
const TAX_BPS = 700n
const DEPOSIT_BPS = 500n
const DISPUTE_BOND_BPS = 200n
const STATUS = {
  Booked: 0n,
  Cancelled: 1n,
  CheckedIn: 2n,
  Completed: 3n,
  NoShow: 4n,
  Disputed: 5n,
  ResolvedGuest: 6n,
  ResolvedHost: 7n,
}

async function setNextTimestamp(timestamp) {
  await network.provider.send('evm_setNextBlockTimestamp', [Number(timestamp)])
}

async function deployFixture() {
  const [admin, treasury, pauser, arbitrator, host, guest, guest2, stranger] =
    await ethers.getSigners()
  const token = await ethers.deployContract('MockUSDC')
  await token.waitForDeployment()
  const booking = await ethers.deployContract('HospitalityBookingV3', [
    await token.getAddress(),
    treasury.address,
    Number(TAX_BPS),
    Number(DEPOSIT_BPS),
    Number(DISPUTE_BOND_BPS),
    admin.address,
    pauser.address,
    arbitrator.address,
  ])
  await booking.waitForDeployment()
  await token.mint(guest.address, 10_000_000_000n)
  await token.mint(guest2.address, 10_000_000_000n)
  await token.mint(host.address, 10_000_000_000n)
  await booking
    .connect(host)
    .createListing('Hotel', 'ipfs://listing', 'ipfs://image', 5, 0, 0)
  await booking.connect(host).addRoomType(1, 'Suite', 'ipfs://room', PRICE, 3)
  const block = await ethers.provider.getBlock('latest')
  const today = Math.floor(Number(block.timestamp) / DAY)
  return {
    booking,
    token,
    admin,
    treasury,
    pauser,
    arbitrator,
    host,
    guest,
    guest2,
    stranger,
    checkInDay: today + 2,
  }
}

function amountFor(rooms, nights, price = PRICE) {
  const base = price * BigInt(rooms) * BigInt(nights)
  const deposit = (base * DEPOSIT_BPS) / 10_000n
  return { base, deposit, total: base + deposit }
}

function disputeBondFor(escrowedAmount) {
  return (escrowedAmount * DISPUTE_BOND_BPS + 9_999n) / 10_000n
}

async function openDispute(fixture, opener, bookingId, evidence) {
  const record = await fixture.booking.getBooking(bookingId)
  const bond = disputeBondFor(record.escrowedAmount)
  await fixture.token.connect(opener).approve(await fixture.booking.getAddress(), bond)
  await fixture.booking.connect(opener).openDispute(bookingId, evidence)
  return bond
}

async function expectExactLiability(fixture) {
  expect(await fixture.token.balanceOf(await fixture.booking.getAddress())).to.equal(
    await fixture.booking.liabilityBalance()
  )
}

async function bookStay(fixture, options = {}) {
  const signer = options.signer || fixture.guest
  const rooms = options.rooms || 1
  const checkInDay = options.checkInDay || fixture.checkInDay
  const checkOutDay = options.checkOutDay || checkInDay + 2
  const cost = amountFor(rooms, checkOutDay - checkInDay, options.price || PRICE)
  await fixture.token.connect(signer).approve(await fixture.booking.getAddress(), cost.total)
  await fixture.booking.connect(signer).book(1, 1, rooms, checkInDay, checkOutDay)
  return {
    bookingId: await fixture.booking.totalBookings(),
    checkInDay,
    checkOutDay,
    cost,
  }
}

async function signAuthorization(fixture, bookingId, overrides = {}) {
  const record = await fixture.booking.getBooking(bookingId)
  const networkInfo = await ethers.provider.getNetwork()
  const domain = {
    name: 'HospitalityBookingV3',
    version: '1',
    chainId: overrides.chainId || networkInfo.chainId,
    verifyingContract: await fixture.booking.getAddress(),
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
  const value = {
    bookingId,
    guest: overrides.guest || record.guest,
    nonce: overrides.nonce ?? record.authorizationNonce,
    validAfter: overrides.validAfter ?? record.scheduledCheckIn,
    validUntil: overrides.validUntil ?? record.checkInDeadline,
  }
  return {
    ...value,
    signature: await (overrides.signer || fixture.host).signTypedData(domain, types, value),
  }
}

describe('HospitalityBookingV3', () => {
  it('uses canonical exclusive epoch-day ranges and snapshots atomic prices', async () => {
    const fixture = await deployFixture()
    const { cost } = await bookStay(fixture)
    const record = await fixture.booking.getBooking(1)
    expect(record.checkInDay).to.equal(fixture.checkInDay)
    expect(record.checkOutDay).to.equal(fixture.checkInDay + 2)
    expect(record.basePrice).to.equal(cost.base)
    expect(record.escrowedAmount).to.equal(cost.total)
    expect(await fixture.booking.occupiedRoomsOnDay(1, fixture.checkInDay)).to.equal(1)
    expect(await fixture.booking.occupiedRoomsOnDay(1, fixture.checkInDay + 1)).to.equal(1)
    expect(await fixture.booking.occupiedRoomsOnDay(1, fixture.checkInDay + 2)).to.equal(0)
    expect(await fixture.booking.ownerOf(1)).to.equal(fixture.guest.address)
  })

  it('rejects empty, past, and over-90-night stays', async () => {
    const fixture = await deployFixture()
    const { booking, token, guest, checkInDay } = fixture
    await token.connect(guest).approve(await booking.getAddress(), ethers.MaxUint256)
    await expect(booking.connect(guest).book(1, 1, 1, checkInDay, checkInDay)).to.be.revertedWithCustomError(
      booking,
      'InvalidInput'
    )
    await expect(
      booking.connect(guest).book(1, 1, 1, checkInDay, checkInDay + 91)
    ).to.be.revertedWithCustomError(booking, 'InvalidInput')
    const block = await ethers.provider.getBlock('latest')
    const today = Math.floor(Number(block.timestamp) / DAY)
    await expect(booking.connect(guest).book(1, 1, 1, today, today + 1)).to.be.revertedWithCustomError(
      booking,
      'InvalidTiming'
    )
  })

  it('checks every interior day while allowing consecutive exclusive ranges', async () => {
    const fixture = await deployFixture()
    await bookStay(fixture, { rooms: 2, checkOutDay: fixture.checkInDay + 3 })
    await expect(
      bookStay(fixture, {
        signer: fixture.guest2,
        rooms: 2,
        checkInDay: fixture.checkInDay + 1,
      })
    ).to.be.rejectedWith(/CapacityExceeded/)
    const next = fixture.checkInDay + 3
    await bookStay(fixture, {
      signer: fixture.guest2,
      rooms: 3,
      checkInDay: next,
      checkOutDay: next + 1,
    })
    expect(await fixture.booking.occupiedRoomsOnDay(1, next)).to.equal(3)
  })

  it('deactivates without deleting history or blocking settlement', async () => {
    const fixture = await deployFixture()
    await bookStay(fixture)
    await fixture.booking.connect(fixture.host).setListingActive(1, false)
    expect((await fixture.booking.getListing(1)).active).to.equal(false)
    await fixture.token
      .connect(fixture.guest2)
      .approve(await fixture.booking.getAddress(), ethers.MaxUint256)
    await expect(
      fixture.booking
        .connect(fixture.guest2)
        .book(1, 1, 1, fixture.checkInDay + 3, fixture.checkInDay + 4)
    ).to.be.revertedWithCustomError(fixture.booking, 'InvalidState')
    expect(
      await fixture.booking.isAvailable(1, 1, fixture.checkInDay + 3, fixture.checkInDay + 4)
    ).to.equal(false)
    await fixture.booking.connect(fixture.guest).cancelBooking(1)
    expect((await fixture.booking.getBooking(1)).status).to.equal(STATUS.Cancelled)
  })

  it('only permits inventory and capacity increases within listing totals', async () => {
    const { booking, host } = await deployFixture()
    await expect(booking.connect(host).increaseListingRooms(1, 4)).to.be.revertedWithCustomError(
      booking,
      'InvalidInput'
    )
    await expect(booking.connect(host).increaseRoomTypeCapacity(1, 6)).to.be.revertedWithCustomError(
      booking,
      'CapacityExceeded'
    )
    await booking.connect(host).increaseListingRooms(1, 7)
    await booking.connect(host).increaseRoomTypeCapacity(1, 6)
    expect((await booking.getRoomType(1)).capacity).to.equal(6)
  })

  it('conserves every atomic unit on cancellation, including remainders', async () => {
    const fixture = await deployFixture()
    const { cost } = await bookStay(fixture, { checkOutDay: fixture.checkInDay + 1 })
    await fixture.booking.connect(fixture.guest).cancelBooking(1)
    const hostShare = cost.deposit / 2n
    expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(cost.base)
    expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(hostShare)
    expect(await fixture.booking.pendingWithdrawals(fixture.treasury.address)).to.equal(
      cost.deposit - hostShare
    )
    expect(await fixture.booking.totalActiveEscrow()).to.equal(0)
    expect(await fixture.booking.totalPendingWithdrawals()).to.equal(cost.total)
  })

  it('conserves accounting when tax and deposit components round to zero', async () => {
    const fixture = await deployFixture()
    await fixture.booking
      .connect(fixture.host)
      .addRoomType(1, 'Atomic room', 'ipfs://atomic', 1, 1)
    await fixture.token.connect(fixture.guest).approve(await fixture.booking.getAddress(), 1)
    await fixture.booking
      .connect(fixture.guest)
      .book(1, 2, 1, fixture.checkInDay, fixture.checkInDay + 1)
    const record = await fixture.booking.getBooking(1)
    expect(record.securityDeposit).to.equal(0)
    await setNextTimestamp(record.checkInDeadline + 1n)
    await fixture.booking.settleNoShow(1)
    expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(1)
    expect(await fixture.booking.liabilityBalance()).to.equal(1)
  })

  it('rejects fee-on-transfer tokens when exact receipt differs', async () => {
    const [admin, treasury, pauser, arbitrator, host, guest] = await ethers.getSigners()
    const token = await ethers.deployContract('FeeOnTransferUSDC')
    const booking = await ethers.deployContract('HospitalityBookingV3', [
      await token.getAddress(),
      treasury.address,
      700,
      500,
      200,
      admin.address,
      pauser.address,
      arbitrator.address,
    ])
    await booking.connect(host).createListing('Hotel', 'ipfs://listing', 'ipfs://image', 1, 0, 0)
    await booking.connect(host).addRoomType(1, 'Room', 'ipfs://room', 100_000_000, 1)
    await token.mint(guest.address, 1_000_000_000)
    await token.connect(guest).approve(await booking.getAddress(), ethers.MaxUint256)
    const block = await ethers.provider.getBlock('latest')
    const checkInDay = Math.floor(Number(block.timestamp) / DAY) + 2
    await expect(
      booking.connect(guest).book(1, 1, 1, checkInDay, checkInDay + 1)
    ).to.be.revertedWithCustomError(booking, 'PaymentMismatch')
  })

  it('keeps no-show unavailable through the complete check-in window', async () => {
    const fixture = await deployFixture()
    await bookStay(fixture)
    const record = await fixture.booking.getBooking(1)
    await setNextTimestamp(record.checkInDeadline)
    await expect(fixture.booking.connect(fixture.stranger).settleNoShow(1)).to.be.revertedWithCustomError(
      fixture.booking,
      'InvalidTiming'
    )
    await setNextTimestamp(record.checkInDeadline + 1n)
    await fixture.booking.connect(fixture.stranger).settleNoShow(1)
    expect((await fixture.booking.getBooking(1)).status).to.equal(STATUS.NoShow)
  })

  it('accepts one guest-bound host EIP-712 authorization and rejects replay', async () => {
    const fixture = await deployFixture()
    const { cost } = await bookStay(fixture)
    const auth = await signAuthorization(fixture, 1n)
    await setNextTimestamp(auth.validAfter)
    await fixture.booking
      .connect(fixture.guest)
      .checkIn(1, auth.validAfter, auth.validUntil, auth.nonce, auth.signature)
    expect((await fixture.booking.getBooking(1)).status).to.equal(STATUS.CheckedIn)
    expect(await fixture.booking.totalActiveEscrow()).to.equal(cost.base)
    expect(await fixture.booking.totalPendingWithdrawals()).to.equal(cost.deposit)
    await expectExactLiability(fixture)
    await expect(
      fixture.booking
        .connect(fixture.guest)
        .checkIn(1, auth.validAfter, auth.validUntil, auth.nonce, auth.signature)
    ).to.be.revertedWithCustomError(fixture.booking, 'InvalidState')
  })

  it('rejects wrong guest, host, chain, expired, and revoked authorizations', async () => {
    for (const variant of ['wrongGuest', 'wrongHost', 'wrongChain', 'expired', 'revoked']) {
      const fixture = await deployFixture()
      await bookStay(fixture)
      const record = await fixture.booking.getBooking(1)
      let auth
      if (variant === 'wrongGuest') {
        auth = await signAuthorization(fixture, 1n, { guest: fixture.guest2.address })
      } else if (variant === 'wrongHost') {
        auth = await signAuthorization(fixture, 1n, { signer: fixture.stranger })
      } else if (variant === 'wrongChain') {
        const networkInfo = await ethers.provider.getNetwork()
        auth = await signAuthorization(fixture, 1n, { chainId: networkInfo.chainId + 1n })
      } else {
        auth = await signAuthorization(fixture, 1n)
      }
      if (variant === 'revoked') {
        await fixture.booking.connect(fixture.host).revokeCheckInAuthorization(1)
      }
      await setNextTimestamp(
        variant === 'expired' ? record.checkInDeadline + 1n : record.scheduledCheckIn
      )
      await expect(
        fixture.booking
          .connect(fixture.guest)
          .checkIn(1, auth.validAfter, auth.validUntil, auth.nonce, auth.signature)
      ).to.be.reverted
    }
  })

  it('allows permissionless completion only after the post-checkout dispute window', async () => {
    const fixture = await deployFixture()
    await bookStay(fixture)
    const auth = await signAuthorization(fixture, 1n)
    await setNextTimestamp(auth.validAfter)
    await fixture.booking
      .connect(fixture.guest)
      .checkIn(1, auth.validAfter, auth.validUntil, auth.nonce, auth.signature)
    const record = await fixture.booking.getBooking(1)
    await expect(fixture.booking.connect(fixture.stranger).completeStay(1)).to.be.revertedWithCustomError(
      fixture.booking,
      'InvalidTiming'
    )
    const disputeWindow = BigInt(DAY)
    await setNextTimestamp(record.scheduledCheckout + disputeWindow)
    await expect(fixture.booking.connect(fixture.stranger).completeStay(1)).to.be.revertedWithCustomError(
      fixture.booking,
      'InvalidTiming'
    )
    await setNextTimestamp(record.scheduledCheckout + disputeWindow + 1n)
    await fixture.booking.connect(fixture.stranger).completeStay(1)
    expect((await fixture.booking.getBooking(1)).status).to.equal(STATUS.Completed)
    expect(await fixture.booking.totalActiveEscrow()).to.equal(0)
    await expectExactLiability(fixture)
  })

  it('freezes disputes and resolves only to predefined outcomes', async () => {
    for (const outcome of [0, 1]) {
      const fixture = await deployFixture()
      const { cost } = await bookStay(fixture)
      const evidence = ethers.keccak256(ethers.toUtf8Bytes(`evidence-${outcome}`))
      const reason = ethers.keccak256(ethers.toUtf8Bytes(`reason-${outcome}`))
      const bond = await openDispute(fixture, fixture.guest, 1, evidence)
      await expect(
        fixture.booking.connect(fixture.guest).cancelBooking(1)
      ).to.be.revertedWithCustomError(fixture.booking, 'InvalidState')
      await fixture.booking.connect(fixture.arbitrator).resolveDispute(1, outcome, reason)
      const record = await fixture.booking.getBooking(1)
      expect(record.status).to.equal(outcome === 0 ? STATUS.ResolvedGuest : STATUS.ResolvedHost)
      expect(await fixture.booking.totalPendingWithdrawals()).to.equal(cost.total + bond)
      await expectExactLiability(fixture)
    }
  })

  it('lets the guest recover after a silent host dispute and rejects early timeout resolution', async () => {
    const fixture = await deployFixture()
    const { cost } = await bookStay(fixture)
    const bond = await openDispute(
      fixture,
      fixture.host,
      1,
      ethers.keccak256(ethers.toUtf8Bytes('host-evidence'))
    )
    expect(await fixture.booking.totalActiveEscrow()).to.equal(cost.total + bond)
    await expectExactLiability(fixture)

    await expect(
      fixture.booking.connect(fixture.stranger).resolveDisputeAfterDeadline(1)
    ).to.be.revertedWithCustomError(fixture.booking, 'InvalidTiming')

    await setNextTimestamp((await fixture.booking.disputeDeadline(1)) + 1n)
    await fixture.booking.connect(fixture.stranger).resolveDisputeAfterDeadline(1)
    expect((await fixture.booking.getBooking(1)).status).to.equal(STATUS.ResolvedGuest)
    expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(
      cost.total + bond
    )
    expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(0)
    expect(await fixture.booking.totalActiveEscrow()).to.equal(0)
    await expectExactLiability(fixture)
  })

  it('refunds the opener bond on a win and forfeits it to the counterparty on a loss', async () => {
    for (const outcome of [0, 1]) {
      const fixture = await deployFixture()
      const { cost } = await bookStay(fixture)
      const bond = await openDispute(
        fixture,
        fixture.guest,
        1,
        ethers.keccak256(ethers.toUtf8Bytes(`bond-${outcome}`))
      )
      await fixture.booking
        .connect(fixture.arbitrator)
        .resolveDispute(1, outcome, ethers.keccak256(ethers.toUtf8Bytes(`decision-${outcome}`)))

      if (outcome === 0) {
        expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(
          cost.total + bond
        )
      } else {
        expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(0)
        expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(
          cost.base - (cost.base * TAX_BPS) / 10_000n + cost.deposit + bond
        )
      }
      await expectExactLiability(fixture)
    }
  })

  it('resolves both outcomes for disputes opened after check-in and checkout', async () => {
    for (const outcome of [0, 1]) {
      const fixture = await deployFixture()
      const { cost } = await bookStay(fixture)
      const auth = await signAuthorization(fixture, 1n)
      await setNextTimestamp(auth.validAfter)
      await fixture.booking
        .connect(fixture.guest)
        .checkIn(1, auth.validAfter, auth.validUntil, auth.nonce, auth.signature)

      expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(0)
      expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(cost.deposit)
      expect(await fixture.booking.totalActiveEscrow()).to.equal(cost.base)
      const checkedIn = await fixture.booking.getBooking(1)
      await setNextTimestamp(checkedIn.scheduledCheckout + 1n)
      const bond = await openDispute(
        fixture,
        fixture.guest,
        1,
        ethers.keccak256(ethers.toUtf8Bytes(`unusable-room-${outcome}`))
      )
      expect(await fixture.booking.totalActiveEscrow()).to.equal(cost.base + bond)
      await expectExactLiability(fixture)

      await fixture.booking
        .connect(fixture.arbitrator)
        .resolveDispute(1, outcome, ethers.keccak256(ethers.toUtf8Bytes(`stay-ruling-${outcome}`)))
      if (outcome === 0) {
        expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(
          cost.total + bond
        )
        expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(0)
      } else {
        const tax = (cost.base * TAX_BPS) / 10_000n
        expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(cost.deposit)
        expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(
          cost.base - tax + bond
        )
        expect(await fixture.booking.pendingWithdrawals(fixture.treasury.address)).to.equal(tax)
      }
      expect(await fixture.booking.totalActiveEscrow()).to.equal(0)
      await expectExactLiability(fixture)
    }
  })

  it('prevents host withdrawal until an undisputed stay completes after the dispute window', async () => {
    const fixture = await deployFixture()
    const { cost } = await bookStay(fixture)
    const auth = await signAuthorization(fixture, 1n)
    await setNextTimestamp(auth.validAfter)
    await fixture.booking
      .connect(fixture.guest)
      .checkIn(1, auth.validAfter, auth.validUntil, auth.nonce, auth.signature)
    await expect(fixture.booking.connect(fixture.host).withdraw()).to.be.revertedWithCustomError(
      fixture.booking,
      'NoFunds'
    )

    const record = await fixture.booking.getBooking(1)
    await setNextTimestamp(record.scheduledCheckout + BigInt(DAY) + 1n)
    await fixture.token
      .connect(fixture.guest)
      .approve(await fixture.booking.getAddress(), disputeBondFor(record.escrowedAmount))
    await expect(
      fixture.booking
        .connect(fixture.guest)
        .openDispute(1, ethers.keccak256(ethers.toUtf8Bytes('too-late')))
    ).to.be.revertedWithCustomError(fixture.booking, 'InvalidTiming')
    await fixture.booking.connect(fixture.stranger).completeStay(1)
    const hostPayout = cost.base - (cost.base * TAX_BPS) / 10_000n
    expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(hostPayout)
    await expectExactLiability(fixture)
    await fixture.booking.connect(fixture.host).withdraw()
    expect(await fixture.booking.pendingWithdrawals(fixture.host.address)).to.equal(0)
    await expectExactLiability(fixture)
  })

  it('uses pull withdrawals and preserves credit when a transfer fails', async () => {
    const fixture = await deployFixture()
    await bookStay(fixture)
    await fixture.booking.connect(fixture.guest).cancelBooking(1)
    const credit = await fixture.booking.pendingWithdrawals(fixture.guest.address)
    await fixture.token.setBlockedRecipient(fixture.guest.address, true)
    await expect(fixture.booking.connect(fixture.guest).withdraw()).to.be.revertedWith(
      'MockUSDC: recipient blocked'
    )
    expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(credit)
    await fixture.token.setBlockedRecipient(fixture.guest.address, false)
    await fixture.booking.connect(fixture.guest).withdraw()
    expect(await fixture.booking.pendingWithdrawals(fixture.guest.address)).to.equal(0)
  })

  it('rejects NFT transfers and produces valid escaped JSON', async () => {
    const fixture = await deployFixture()
    await fixture.booking
      .connect(fixture.host)
      .updateListingMetadata(1, 'Hotel', 'ipfs://listing', 'ipfs://image"line\n')
    await fixture.booking
      .connect(fixture.host)
      .updateRoomTypeMetadata(1, 'Suite "North"\nWing', 'ipfs://room')
    await bookStay(fixture)
    await expect(
      fixture.booking.connect(fixture.guest).approve(fixture.guest2.address, 1)
    ).to.be.revertedWithCustomError(fixture.booking, 'NonTransferable')
    await expect(
      fixture.booking
        .connect(fixture.guest)
        .transferFrom(fixture.guest.address, fixture.guest2.address, 1)
    ).to.be.revertedWithCustomError(fixture.booking, 'NonTransferable')
    const uri = await fixture.booking.tokenURI(1)
    const json = JSON.parse(Buffer.from(uri.split('base64,')[1], 'base64').toString('utf8'))
    const attrs = Object.fromEntries(json.attributes.map((item) => [item.trait_type, item.value]))
    expect(json.image).to.equal('ipfs://image"line\n')
    expect(attrs['Room Type']).to.equal('Suite "North"\nWing')
    expect(attrs.CheckOutDay).to.equal(String(fixture.checkInDay + 2))
    expect(attrs.Status).to.equal('Booked')
  })

  it('allows exactly one IPFS-hashed review after host-attested check-in', async () => {
    const fixture = await deployFixture()
    await bookStay(fixture)
    const hash = ethers.keccak256(ethers.toUtf8Bytes('{"rating":5}'))
    await expect(
      fixture.booking.connect(fixture.guest).submitReview(1, 5, 'ipfs://review', hash)
    ).to.be.revertedWithCustomError(fixture.booking, 'InvalidState')
    const auth = await signAuthorization(fixture, 1n)
    await setNextTimestamp(auth.validAfter)
    await fixture.booking
      .connect(fixture.guest)
      .checkIn(1, auth.validAfter, auth.validUntil, auth.nonce, auth.signature)
    await fixture.booking.connect(fixture.guest).submitReview(1, 5, 'ipfs://review', hash)
    expect((await fixture.booking.getReview(1)).contentHash).to.equal(hash)
    await expect(
      fixture.booking.connect(fixture.guest).submitReview(1, 4, 'ipfs://second', hash)
    ).to.be.revertedWithCustomError(fixture.booking, 'InvalidState')
  })

  it('pauses protocol writes', async () => {
    const fixture = await deployFixture()
    await fixture.booking.connect(fixture.pauser).pause()
    await expect(bookStay(fixture)).to.be.rejectedWith(/EnforcedPause/)
    await fixture.booking.connect(fixture.pauser).unpause()
    await bookStay(fixture)
  })

  it('uses exact bounded pages without filtering deactivated IDs', async () => {
    const { booking, host } = await deployFixture()
    await booking.connect(host).createListing('Two', 'ipfs://two', 'ipfs://two-image', 1, 0, 0)
    await booking.connect(host).createListing('Three', 'ipfs://three', 'ipfs://three-image', 1, 0, 0)
    await booking.connect(host).setListingActive(2, false)
    const [first, next] = await booking.getListingsPage(0, 2)
    const [second, done] = await booking.getListingsPage(next, 2)
    expect(first.map((item) => Number(item.id))).to.deep.equal([1, 2])
    expect(first[1].active).to.equal(false)
    expect(second.map((item) => Number(item.id))).to.deep.equal([3])
    expect(done).to.equal(0)
    await expect(booking.getListingsPage(0, 51)).to.be.revertedWithCustomError(
      booking,
      'InvalidPagination'
    )
  })

  it('recovers only balances proven above all liabilities', async () => {
    const fixture = await deployFixture()
    const { cost } = await bookStay(fixture)
    await expect(
      fixture.booking.connect(fixture.admin).recoverExcessPaymentToken()
    ).to.be.revertedWithCustomError(fixture.booking, 'NoFunds')
    await fixture.token.mint(await fixture.booking.getAddress(), 123n)
    const before = await fixture.token.balanceOf(fixture.treasury.address)
    await fixture.booking.connect(fixture.admin).recoverExcessPaymentToken()
    expect(await fixture.token.balanceOf(fixture.treasury.address)).to.equal(before + 123n)
    expect(await fixture.token.balanceOf(await fixture.booking.getAddress())).to.equal(cost.total)
  })
})
