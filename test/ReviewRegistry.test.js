const { expect } = require('chai')
const { ethers, network } = require('hardhat')

const DAY = 86_400
const PRICE = 150_000_000n // 150 USDC/night at 6 decimals
const TAX_BPS = 700n
const DEPOSIT_BPS = 500n
const DISPUTE_BOND_BPS = 200n
const BPS = 10_000n

// Registry configuration under test.
const ELIGIBILITY_BPS = 5_000 // R1: a review needs >= 50% of the reference value
const SATURATION_BPS = 10_000 // R2: weight saturates at 100% of the reference value
const REPEAT_WEIGHT_BPS = 2_500 // R3c: repeat reviews of the same host cap at 25%
const UNATTESTED_WEIGHT_BPS = 5_000 // R4: a self-asserted check-in counts at 50%

const URI = 'ipfs://bafyreigh2akiscaildcexampleexampleexampleexample'
const HASH = ethers.keccak256(ethers.toUtf8Bytes('review-content'))

async function setNextTimestamp(timestamp) {
  await network.provider.send('evm_setNextBlockTimestamp', [Number(timestamp)])
}

async function deployFixture() {
  const [admin, treasury, pauser, arbitrator, host, guest, guest2, host2] =
    await ethers.getSigners()
  const token = await ethers.deployContract('MockUSDC')
  const booking = await ethers.deployContract('HospitalityBooking', [
    await token.getAddress(),
    treasury.address,
    Number(TAX_BPS),
    Number(DEPOSIT_BPS),
    Number(DISPUTE_BOND_BPS),
    admin.address,
    pauser.address,
    arbitrator.address,
  ])
  const registry = await ethers.deployContract('ReviewRegistry', [
    await booking.getAddress(),
    ELIGIBILITY_BPS,
    SATURATION_BPS,
    REPEAT_WEIGHT_BPS,
    UNATTESTED_WEIGHT_BPS,
  ])
  for (const who of [guest, guest2, host, host2]) {
    await token.mint(who.address, 100_000_000_000n)
  }
  // Listing 1 advertises a 150 USDC/night suite: that is the reference price.
  await booking.connect(host).createListing('Hotel', 'ipfs://listing', 'ipfs://image', 30, 0, 0)
  await booking.connect(host).addRoomType(1, 'Suite', 'ipfs://room', PRICE, 5)
  const block = await ethers.provider.getBlock('latest')
  const today = Math.floor(Number(block.timestamp) / DAY)
  return {
    booking, registry, token, admin, treasury, pauser, arbitrator,
    host, guest, guest2, host2, today,
  }
}

async function addCheapRoomType(fixture, price) {
  await fixture.booking.connect(fixture.host).addRoomType(1, 'Broom', 'ipfs://broom', price, 5)
  return Number(await fixture.booking.totalRoomTypes())
}

/** Book, host-authorize, and check in. Returns the booking id. */
async function stay(fixture, options = {}) {
  const guest = options.guest || fixture.guest
  const host = options.host || fixture.host
  const listingId = options.listingId || 1
  const roomTypeId = options.roomTypeId || 1
  const rooms = options.rooms || 1
  const nights = options.nights || 1
  const checkInDay = options.checkInDay || fixture.today + 2 + (options.dayOffset || 0)
  const checkOutDay = checkInDay + nights

  const room = await fixture.booking.getRoomType(roomTypeId)
  const base = room.pricePerNight * BigInt(rooms) * BigInt(nights)
  const total = base + (base * DEPOSIT_BPS) / BPS
  await fixture.token.connect(guest).approve(await fixture.booking.getAddress(), total)
  await fixture.booking.connect(guest).book(listingId, roomTypeId, rooms, checkInDay, checkOutDay)
  const bookingId = await fixture.booking.totalBookings()

  const record = await fixture.booking.getBooking(bookingId)
  const net = await ethers.provider.getNetwork()
  const signature = await host.signTypedData(
    {
      name: 'HospitalityBooking',
      version: '1',
      chainId: net.chainId,
      verifyingContract: await fixture.booking.getAddress(),
    },
    {
      CheckInAuthorization: [
        { name: 'bookingId', type: 'uint256' },
        { name: 'guest', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'validAfter', type: 'uint64' },
        { name: 'validUntil', type: 'uint64' },
      ],
    },
    {
      bookingId,
      guest: record.guest,
      nonce: record.authorizationNonce,
      validAfter: record.scheduledCheckIn,
      validUntil: record.checkInDeadline,
    }
  )
  await setNextTimestamp(record.scheduledCheckIn)
  if (options.attested === false) {
    await fixture.booking.connect(guest).checkIn(bookingId)
  } else {
    await fixture.booking
      .connect(guest)
      .checkInAttested(bookingId, record.scheduledCheckIn, record.checkInDeadline, record.authorizationNonce, signature)
  }
  return bookingId
}

async function weightOf(fixture, bookingId) {
  return BigInt((await fixture.registry.getReview(bookingId)).weightBps)
}

describe('ReviewRegistry', function () {
  it('gives a full-price genuine stay full weight', async () => {
    const fixture = await deployFixture()
    const id = await stay(fixture)
    await fixture.registry.connect(fixture.guest).submitReview(id, 5, URI, HASH)
    expect(await weightOf(fixture, id)).to.equal(10_000n)
    expect(await fixture.registry.weightedRating(1)).to.equal(50_000n) // 5.0000
    expect(await fixture.registry.rawRating(1)).to.equal(50_000n)
  })

  it('R1: rejects a review bought through a near-zero room type', async () => {
    const fixture = await deployFixture()
    const cheapRoom = await addCheapRoomType(fixture, 1n) // 1 atomic unit per night
    const id = await stay(fixture, { roomTypeId: cheapRoom })
    // The reference stays at the listing's advertised 150 USDC suite, so a
    // 1-unit booking is nowhere near the 50% floor.
    await expect(
      fixture.registry.connect(fixture.guest).submitReview(id, 5, URI, HASH)
    ).to.be.revertedWithCustomError(fixture.registry, 'NotEligible')
  })

  it('R1: the floor scales with nights and rooms', async () => {
    const fixture = await deployFixture()
    const threshold1 = await fixture.registry.reviewEligibilityThreshold(1, 1, 1)
    const threshold6 = await fixture.registry.reviewEligibilityThreshold(1, 3, 2)
    expect(threshold1).to.equal((PRICE * BigInt(ELIGIBILITY_BPS)) / BPS)
    expect(threshold6).to.equal(threshold1 * 6n)
  })

  it('R1: a host can only lower the floor by lowering real prices', async () => {
    const fixture = await deployFixture()
    const before = await fixture.registry.reviewEligibilityThreshold(1, 1, 1)
    await addCheapRoomType(fixture, 1n)
    expect(await fixture.registry.reviewEligibilityThreshold(1, 1, 1)).to.equal(before)
    // Only cutting the advertised suite price moves the reference.
    await fixture.booking.connect(fixture.host).updateRoomTypePrice(1, PRICE / 10n)
    expect(await fixture.registry.reviewEligibilityThreshold(1, 1, 1)).to.equal(before / 10n)
  })

  it('R2: weight rises with paid value and saturates at the reference', async () => {
    const fixture = await deployFixture()
    const halfRoom = await addCheapRoomType(fixture, PRICE / 2n)
    const half = await stay(fixture, { roomTypeId: halfRoom })
    await fixture.registry.connect(fixture.guest).submitReview(half, 5, URI, HASH)
    expect(await weightOf(fixture, half)).to.equal(5_000n)

    const full = await stay(fixture, { guest: fixture.guest2, dayOffset: 5 })
    await fixture.registry.connect(fixture.guest2).submitReview(full, 5, URI, HASH)
    expect(await weightOf(fixture, full)).to.equal(10_000n)
  })

  it('R3a: a host reviewing their own listing carries zero weight', async () => {
    const fixture = await deployFixture()
    const id = await stay(fixture, { guest: fixture.host })
    await fixture.registry.connect(fixture.host).submitReview(id, 5, URI, HASH)
    expect(await weightOf(fixture, id)).to.equal(0n)
    expect(await fixture.registry.weightedRating(1)).to.equal(0n)
    // The raw aggregate still shows the manipulation, which is the point.
    expect(await fixture.registry.rawRating(1)).to.equal(50_000n)
  })

  it('R3b: reciprocal review rings are zeroed', async () => {
    const fixture = await deployFixture()
    // host2 lists, and the two owners stay at each other's properties.
    await fixture.booking
      .connect(fixture.host2)
      .createListing('Rival', 'ipfs://rival', 'ipfs://rival-img', 30, 0, 0)
    await fixture.booking.connect(fixture.host2).addRoomType(2, 'Suite', 'ipfs://r2', PRICE, 5)

    const a = await stay(fixture, { guest: fixture.host2 })
    await fixture.registry.connect(fixture.host2).submitReview(a, 5, URI, HASH)
    expect(await weightOf(fixture, a)).to.equal(10_000n)

    const b = await stay(fixture, {
      guest: fixture.host,
      host: fixture.host2,
      listingId: 2,
      roomTypeId: 2,
      dayOffset: 5,
    })
    await fixture.registry.connect(fixture.host).submitReview(b, 5, URI, HASH)
    expect(await weightOf(fixture, b)).to.equal(0n)
  })

  it('R3c: repeat reviews of the same host are discounted', async () => {
    const fixture = await deployFixture()
    const first = await stay(fixture)
    await fixture.registry.connect(fixture.guest).submitReview(first, 5, URI, HASH)
    expect(await weightOf(fixture, first)).to.equal(10_000n)

    const second = await stay(fixture, { dayOffset: 5 })
    await fixture.registry.connect(fixture.guest).submitReview(second, 5, URI, HASH)
    expect(await weightOf(fixture, second)).to.equal(BigInt(REPEAT_WEIGHT_BPS))
  })

  it('weighted and unweighted ratings diverge under a self-review attack', async () => {
    const fixture = await deployFixture()
    const honest = await stay(fixture)
    await fixture.registry.connect(fixture.guest).submitReview(honest, 1, URI, HASH)

    // The host answers a 1-star review with four self-bookings at full price.
    for (let i = 0; i < 4; i++) {
      const fake = await stay(fixture, { guest: fixture.host, dayOffset: 5 + i * 3 })
      await fixture.registry.connect(fixture.host).submitReview(fake, 5, URI, HASH)
    }
    // Unweighted: 1 + 5*4 = 21 over 5 reviews = 4.2 stars.
    expect(await fixture.registry.rawRating(1)).to.equal(42_000n)
    // Weighted: the self-bookings carry no weight, so the honest review stands.
    expect(await fixture.registry.weightedRating(1)).to.equal(10_000n)
  })

  it('R4: a guest can always check in alone, at reduced review weight', async () => {
    const fixture = await deployFixture()
    const id = await stay(fixture, { attested: false })
    const record = await fixture.booking.getBooking(id)
    expect(record.hostAttested).to.equal(false)
    expect(record.status).to.equal(2n)
    await fixture.registry.connect(fixture.guest).submitReview(id, 5, URI, HASH)
    expect(await weightOf(fixture, id)).to.equal(BigInt(UNATTESTED_WEIGHT_BPS))
  })

  it('R4: a host cannot suppress a review by refusing to sign', async () => {
    const fixture = await deployFixture()
    const id = await stay(fixture, { attested: false })
    await fixture.registry.connect(fixture.guest).submitReview(id, 1, URI, HASH)
    const review = await fixture.registry.getReview(id)
    expect(review.rating).to.equal(1)
    expect(Number(review.weightBps)).to.be.greaterThan(0)
  })

  it('permits exactly one review per booking', async () => {
    const fixture = await deployFixture()
    const id = await stay(fixture)
    await fixture.registry.connect(fixture.guest).submitReview(id, 4, URI, HASH)
    await expect(
      fixture.registry.connect(fixture.guest).submitReview(id, 5, URI, HASH)
    ).to.be.revertedWithCustomError(fixture.registry, 'InvalidState')
  })

  it('only the booking guest may review, and only after a stay', async () => {
    const fixture = await deployFixture()
    const id = await stay(fixture)
    await expect(
      fixture.registry.connect(fixture.guest2).submitReview(id, 5, URI, HASH)
    ).to.be.revertedWithCustomError(fixture.registry, 'Unauthorized')

    // A booking that never reached check-in cannot be reviewed.
    const room = await fixture.booking.getRoomType(1)
    const base = room.pricePerNight
    const total = base + (base * DEPOSIT_BPS) / BPS
    await fixture.token.connect(fixture.guest2).approve(await fixture.booking.getAddress(), total)
    await fixture.booking
      .connect(fixture.guest2)
      .book(1, 1, 1, fixture.today + 20, fixture.today + 21)
    const unstayed = await fixture.booking.totalBookings()
    await expect(
      fixture.registry.connect(fixture.guest2).submitReview(unstayed, 5, URI, HASH)
    ).to.be.revertedWithCustomError(fixture.registry, 'InvalidState')
  })

  it('a guest who wins an arbitration can still review', async () => {
    const fixture = await deployFixture()
    const id = await stay(fixture)
    const record = await fixture.booking.getBooking(id)
    const bond = (record.escrowedAmount * DISPUTE_BOND_BPS + 9_999n) / BPS
    await fixture.token.connect(fixture.guest).approve(await fixture.booking.getAddress(), bond)
    await fixture.booking
      .connect(fixture.guest)
      .openDispute(id, ethers.keccak256(ethers.toUtf8Bytes('unusable-room')))
    await fixture.booking
      .connect(fixture.arbitrator)
      .resolveDispute(id, 0, ethers.keccak256(ethers.toUtf8Bytes('refunded')))

    expect((await fixture.booking.getBooking(id)).status).to.equal(6n) // ResolvedGuest
    // The proof-of-stay token survives a stay that actually happened.
    expect(await fixture.booking.ownerOf(record.tokenId)).to.equal(fixture.guest.address)
    await fixture.registry.connect(fixture.guest).submitReview(id, 1, URI, HASH)
    expect(await weightOf(fixture, id)).to.equal(10_000n)
  })

  it('validates rating range, IPFS URI and content hash', async () => {
    const fixture = await deployFixture()
    const id = await stay(fixture)
    await expect(
      fixture.registry.connect(fixture.guest).submitReview(id, 0, URI, HASH)
    ).to.be.revertedWithCustomError(fixture.registry, 'InvalidInput')
    await expect(
      fixture.registry.connect(fixture.guest).submitReview(id, 6, URI, HASH)
    ).to.be.revertedWithCustomError(fixture.registry, 'InvalidInput')
    await expect(
      fixture.registry.connect(fixture.guest).submitReview(id, 5, URI, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(fixture.registry, 'InvalidInput')
    await expect(
      fixture.registry.connect(fixture.guest).submitReview(id, 5, 'https://evil.example', HASH)
    ).to.be.revertedWithCustomError(fixture.registry, 'InvalidURI')
  })

  it('rejects an invalid configuration', async () => {
    const fixture = await deployFixture()
    const args = [await fixture.booking.getAddress(), 0, SATURATION_BPS, REPEAT_WEIGHT_BPS, UNATTESTED_WEIGHT_BPS]
    await expect(ethers.deployContract('ReviewRegistry', args)).to.be.reverted
  })
})
