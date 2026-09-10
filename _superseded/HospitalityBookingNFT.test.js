const { expect } = require('chai')
const { ethers, network } = require('hardhat')

const toWei = (num) => ethers.parseEther(num.toString())

const TAX_PERCENT = 7
const SECURITY_FEE = 5

const STATUS = { Booked: 0, Cancelled: 1, CheckedIn: 2, Expired: 3 }

const APARTMENT = {
  name: 'Lakeside Apartment',
  description: 'Nice place by the lake',
  location: 'Laramie',
  images: 'https://example.com/a.jpg,https://example.com/b.jpg',
  rooms: 4,
  latitude: '41.3114',
  longitude: '-105.5911',
  pinataJsonLink: 'ipfs://QmMetadata',
  nftName: 'Lakeside Stay Pass',
  nftDescription: 'Proof-of-stay NFT for Lakeside Apartment',
  nftImageUrl: 'ipfs://QmImage',
}

const ROOM = {
  name: 'Deluxe Double',
  description: 'Two queen beds',
  price: 1, // ETH per night
  images: 'https://example.com/room.jpg',
  capacity: 3,
}

async function createApartment(contract, signer, overrides = {}) {
  const a = { ...APARTMENT, ...overrides }
  return contract
    .connect(signer)
    .createAppartment(
      a.name,
      a.description,
      a.location,
      a.images,
      a.rooms,
      a.latitude,
      a.longitude,
      a.pinataJsonLink,
      a.nftName,
      a.nftDescription,
      a.nftImageUrl
    )
}

async function addRoomType(contract, signer, aid, overrides = {}) {
  const r = { ...ROOM, ...overrides }
  return contract
    .connect(signer)
    .addRoomTypeToApartment(aid, r.name, r.description, toWei(r.price), r.images, r.capacity)
}

async function futureDates(count, offsetDays = 1) {
  const block = await ethers.provider.getBlock('latest')
  const start = Number(block.timestamp) + offsetDays * 24 * 60 * 60
  return Array.from({ length: count }, (_, i) => start + i * 24 * 60 * 60)
}

function bookingCost(pricePerNightEth, rooms, nights) {
  const totalPrice = toWei(pricePerNightEth * rooms * nights)
  const fee = (totalPrice * BigInt(SECURITY_FEE)) / 100n
  return { totalPrice, fee, value: totalPrice + fee }
}

async function timeTravelTo(timestamp) {
  await network.provider.send('evm_setNextBlockTimestamp', [timestamp])
  await network.provider.send('evm_mine')
}

describe('HospitalityBookingNFT', () => {
  let contract
  let deployer, host, tenant, other
  const aid = 1
  const roomIdx = 0

  beforeEach(async () => {
    ;[deployer, host, tenant, other] = await ethers.getSigners()
    contract = await ethers.deployContract('HospitalityBookingNFT', [TAX_PERCENT, SECURITY_FEE])
    await contract.waitForDeployment()
    await createApartment(contract, host)
    await addRoomType(contract, host, aid)
  })

  // ------------------------------------------------------------
  // Apartment management
  // ------------------------------------------------------------
  describe('apartment management', () => {
    it('creates an apartment with correct fields and owner', async () => {
      const apt = await contract.getApartment(aid)
      expect(apt.name).to.equal(APARTMENT.name)
      expect(apt.owner).to.equal(host.address)
      expect(apt.deleted).to.equal(false)
      expect(apt.nftName).to.equal(APARTMENT.nftName)
    })

    it('rejects apartment creation with missing required fields', async () => {
      await expect(createApartment(contract, host, { name: '' })).to.be.revertedWith('Name required')
      await expect(createApartment(contract, host, { rooms: 0 })).to.be.revertedWith(
        'Rooms cannot be zero'
      )
      await expect(createApartment(contract, host, { nftImageUrl: '' })).to.be.revertedWith(
        'NFT image required'
      )
    })

    it('only owner can update or delete an apartment', async () => {
      await expect(
        contract.connect(other).updateAppartment(aid, 'x', 'x', 'x', 'x', 1)
      ).to.be.revertedWith('Owner only')
      await expect(contract.connect(other).deleteAppartment(aid)).to.be.revertedWith('Unauthorized')
    })

    it('deleted apartments are excluded from getApartments', async () => {
      await createApartment(contract, host, { name: 'Second' })
      await contract.connect(host).deleteAppartment(aid)
      const list = await contract.getApartments()
      expect(list.length).to.equal(1)
      expect(list[0].name).to.equal('Second')
    })
  })

  // ------------------------------------------------------------
  // Room types
  // ------------------------------------------------------------
  describe('room types', () => {
    it('only apartment owner can add or delete room types', async () => {
      await expect(addRoomType(contract, other, aid)).to.be.revertedWith('Owner only')
      await expect(contract.connect(other).deleteRoomType(aid, 0)).to.be.revertedWith('Owner only')
    })

    it('rejects invalid room type parameters', async () => {
      await expect(addRoomType(contract, host, aid, { price: 0 })).to.be.revertedWith(
        'Room price must be greater than zero'
      )
      await expect(addRoomType(contract, host, aid, { capacity: 0 })).to.be.revertedWith(
        'Room capacity must be greater than zero'
      )
    })

    it('cannot book a deleted room type', async () => {
      await contract.connect(host).deleteRoomType(aid, roomIdx)
      const dates = await futureDates(1)
      const { value } = bookingCost(ROOM.price, 1, 1)
      await expect(
        contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value })
      ).to.be.revertedWith('Room type deleted')
    })
  })

  // ------------------------------------------------------------
  // Booking
  // ------------------------------------------------------------
  describe('booking', () => {
    it('books with exact payment, mints NFT, and records inventory', async () => {
      const dates = await futureDates(2)
      const { totalPrice, value } = bookingCost(ROOM.price, 2, 2)

      await expect(
        contract.connect(tenant).bookApartment(aid, roomIdx, 2, dates, { value })
      ).to.changeEtherBalance(contract, value)

      const bookings = await contract.getBookings(aid)
      expect(bookings.length).to.equal(1)
      const b = bookings[0]
      expect(b.tenant).to.equal(tenant.address)
      expect(b.roomsBooked).to.equal(2n)
      expect(b.totalPrice).to.equal(totalPrice)
      expect(Number(b.status)).to.equal(STATUS.Booked)
      expect(await contract.ownerOf(b.tokenId)).to.equal(tenant.address)
      expect(await contract.roomTypeBookedOnDate(aid, roomIdx, dates[0])).to.equal(2n)
    })

    it('rejects payment that is not exactly price plus security fee', async () => {
      const dates = await futureDates(1)
      const { value } = bookingCost(ROOM.price, 1, 1)
      await expect(
        contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: value - 1n })
      ).to.be.revertedWith('Incorrect payment amount')
      await expect(
        contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: value + 1n })
      ).to.be.revertedWith('Incorrect payment amount')
    })

    it('rejects duplicate dates and past dates', async () => {
      const dates = await futureDates(1)
      const { value } = bookingCost(ROOM.price, 1, 2)
      await expect(
        contract.connect(tenant).bookApartment(aid, roomIdx, 1, [dates[0], dates[0]], { value })
      ).to.be.revertedWith('Duplicate dates')

      const block = await ethers.provider.getBlock('latest')
      const past = Number(block.timestamp) - 24 * 60 * 60
      const single = bookingCost(ROOM.price, 1, 1)
      await expect(
        contract.connect(tenant).bookApartment(aid, roomIdx, 1, [past], { value: single.value })
      ).to.be.revertedWith('Date must be in future')
    })

    it('accepts millisecond timestamps and normalizes them', async () => {
      const dates = await futureDates(1)
      const { value } = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, [dates[0] * 1000], { value })
      const bookings = await contract.getBookings(aid)
      expect(Number(bookings[0].dates[0])).to.equal(dates[0])
    })

    it('enforces per-date capacity across multiple bookings (no double booking)', async () => {
      const dates = await futureDates(1)
      const two = bookingCost(ROOM.price, 2, 1)
      const one = bookingCost(ROOM.price, 1, 1)

      await contract.connect(tenant).bookApartment(aid, roomIdx, 2, dates, { value: two.value })
      await contract.connect(other).bookApartment(aid, roomIdx, 1, dates, { value: one.value })
      // capacity 3 now exhausted for this date
      await expect(
        contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: one.value })
      ).to.be.revertedWith('Room type full')
    })

    it('rejects rooms exceeding capacity in a single booking', async () => {
      const dates = await futureDates(1)
      const { value } = bookingCost(ROOM.price, 4, 1)
      await expect(
        contract.connect(tenant).bookApartment(aid, roomIdx, 4, dates, { value })
      ).to.be.revertedWith('Rooms exceed capacity')
    })
  })

  // ------------------------------------------------------------
  // Check-in and payouts
  // ------------------------------------------------------------
  describe('check-in', () => {
    let dates, cost

    beforeEach(async () => {
      dates = await futureDates(2)
      cost = bookingCost(ROOM.price, 1, 2)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })
    })

    it('rejects check-in before the stay starts and by non-tenant', async () => {
      await expect(contract.connect(tenant).checkInApartment(aid, 0)).to.be.revertedWith(
        'Too early'
      )
      await timeTravelTo(dates[0] + 60)
      await expect(contract.connect(other).checkInApartment(aid, 0)).to.be.revertedWith(
        'Unauthorized tenant'
      )
    })

    it('pays host (minus tax), platform (tax), and returns fee to tenant on check-in', async () => {
      await timeTravelTo(dates[0] + 60)
      const tax = (cost.totalPrice * BigInt(TAX_PERCENT)) / 100n

      const tx = contract.connect(tenant).checkInApartment(aid, 0)
      await expect(tx).to.changeEtherBalances(
        [host, deployer, contract],
        [cost.totalPrice - tax, tax, -(cost.totalPrice + cost.fee)]
      )

      const booking = (await contract.getBookings(aid))[0]
      expect(Number(booking.status)).to.equal(STATUS.CheckedIn)
    })

    it('rejects check-in after the 24-hour window', async () => {
      await timeTravelTo(dates[0] + 24 * 60 * 60 + 60)
      await expect(contract.connect(tenant).checkInApartment(aid, 0)).to.be.revertedWith(
        'Check-in window passed'
      )
    })

    it('host can mark checkout only after check-in', async () => {
      await expect(contract.connect(host).checkout(aid, 0)).to.be.revertedWith('Not checked in')
      await timeTravelTo(dates[0] + 60)
      await contract.connect(tenant).checkInApartment(aid, 0)
      await expect(contract.connect(other).checkout(aid, 0)).to.be.revertedWith('Owner only')
      await contract.connect(host).checkout(aid, 0)
      const booking = (await contract.getBookings(aid))[0]
      expect(Number(booking.status)).to.equal(STATUS.Expired)
    })
  })

  // ------------------------------------------------------------
  // No-show claims
  // ------------------------------------------------------------
  describe('claimFunds (no-show)', () => {
    it('lets host claim escrow plus fee after tenant no-show', async () => {
      const dates = await futureDates(1)
      const cost = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })

      await expect(contract.connect(host).claimFunds(aid, 0)).to.be.revertedWith('Too early')

      await timeTravelTo(dates[0] + 25 * 60 * 60)
      const tax = (cost.totalPrice * BigInt(TAX_PERCENT)) / 100n
      await expect(contract.connect(host).claimFunds(aid, 0)).to.changeEtherBalances(
        [host, deployer, contract],
        [cost.totalPrice - tax + cost.fee, tax, -(cost.totalPrice + cost.fee)]
      )

      const booking = (await contract.getBookings(aid))[0]
      expect(Number(booking.status)).to.equal(STATUS.Expired)
    })

    it('rejects claim by non-owner', async () => {
      const dates = await futureDates(1)
      const cost = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })
      await timeTravelTo(dates[0] + 60 * 60)
      await expect(contract.connect(other).claimFunds(aid, 0)).to.be.revertedWith('Owner only')
    })
  })

  // ------------------------------------------------------------
  // Refunds
  // ------------------------------------------------------------
  describe('refunds', () => {
    let dates, cost

    beforeEach(async () => {
      dates = await futureDates(1)
      cost = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })
    })

    it('refunds full price to tenant, splits fee as collateral, burns NFT, reopens date', async () => {
      const booking = (await contract.getBookings(aid))[0]
      const tokenId = booking.tokenId
      const collateral = cost.fee / 2n

      await expect(contract.connect(tenant).refundBooking(aid, 0)).to.changeEtherBalances(
        [tenant, host, deployer, contract],
        [cost.totalPrice, collateral, collateral, -(cost.totalPrice + collateral * 2n)]
      )

      const after = (await contract.getBookings(aid))[0]
      expect(Number(after.status)).to.equal(STATUS.Cancelled)
      await expect(contract.ownerOf(tokenId)).to.be.reverted
      expect(await contract.roomTypeBookedOnDate(aid, roomIdx, dates[0])).to.equal(0n)

      // date can be booked again
      await contract.connect(other).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })
    })

    it('rejects refund by a stranger and after stay started', async () => {
      await expect(contract.connect(other).refundBooking(aid, 0)).to.be.revertedWith('Tenant only')
      await timeTravelTo(dates[0] + 60)
      await expect(contract.connect(tenant).refundBooking(aid, 0)).to.be.revertedWith(
        'Stay started'
      )
    })

    it('cannot refund twice or refund a checked-in booking', async () => {
      await contract.connect(tenant).refundBooking(aid, 0)
      await expect(contract.connect(tenant).refundBooking(aid, 0)).to.be.revertedWith(
        'Not refundable'
      )
    })
  })

  // ------------------------------------------------------------
  // Reviews
  // ------------------------------------------------------------
  describe('reviews (proof-of-stay gating)', () => {
    it('rejects reviews from users who never checked in', async () => {
      await expect(contract.connect(tenant).addReview(aid, 'Great')).to.be.revertedWith(
        'Check in first'
      )
    })

    it('allows reviews only after a completed check-in', async () => {
      const dates = await futureDates(1)
      const cost = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })
      await timeTravelTo(dates[0] + 60)
      await contract.connect(tenant).checkInApartment(aid, 0)

      await contract.connect(tenant).addReview(aid, 'Excellent stay')
      const reviews = await contract.getReviews(aid)
      expect(reviews.length).to.equal(1)
      expect(reviews[0].owner).to.equal(tenant.address)
    })

    it('keeps review eligibility after check-in even if a later booking is refunded', async () => {
      const first = await futureDates(1)
      const cost = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, first, { value: cost.value })
      await timeTravelTo(first[0] + 60)
      await contract.connect(tenant).checkInApartment(aid, 0)

      const second = await futureDates(1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, second, { value: cost.value })
      await contract.connect(tenant).refundBooking(aid, 1)

      await expect(contract.connect(tenant).addReview(aid, 'Still eligible')).to.not.be.reverted
    })
  })

  // ------------------------------------------------------------
  // NFT metadata
  // ------------------------------------------------------------
  describe('NFT metadata (dynamic tokenURI)', () => {
    it('encodes booking attributes in base64 JSON metadata', async () => {
      const dates = await futureDates(2)
      const cost = bookingCost(ROOM.price, 1, 2)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })

      const booking = (await contract.getBookings(aid))[0]
      const uri = await contract.tokenURI(booking.tokenId)
      expect(uri).to.match(/^data:application\/json;base64,/)

      const json = JSON.parse(
        Buffer.from(uri.split('base64,')[1], 'base64').toString('utf8')
      )
      expect(json.name).to.equal(APARTMENT.nftName)
      expect(json.image).to.equal(APARTMENT.nftImageUrl)
      const attrs = Object.fromEntries(json.attributes.map((a) => [a.trait_type, a.value]))
      expect(attrs['Room Type']).to.equal(ROOM.name)
      expect(attrs['Number of Nights']).to.equal('2')
      expect(attrs['CheckInDate']).to.equal(String(dates[0]))
      expect(attrs['Status']).to.equal(String(STATUS.Booked))
    })

    it('metadata status updates dynamically after check-in', async () => {
      const dates = await futureDates(1)
      const cost = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })
      const booking = (await contract.getBookings(aid))[0]

      await timeTravelTo(dates[0] + 60)
      await contract.connect(tenant).checkInApartment(aid, 0)

      const json = JSON.parse(
        Buffer.from((await contract.tokenURI(booking.tokenId)).split('base64,')[1], 'base64').toString('utf8')
      )
      const attrs = Object.fromEntries(json.attributes.map((a) => [a.trait_type, a.value]))
      expect(attrs['Status']).to.equal(String(STATUS.CheckedIn))
    })

    it('reverts tokenURI for burned tokens', async () => {
      const dates = await futureDates(1)
      const cost = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })
      const booking = (await contract.getBookings(aid))[0]
      await contract.connect(tenant).refundBooking(aid, 0)
      await expect(contract.tokenURI(booking.tokenId)).to.be.revertedWith(
        'URI query for nonexistent token'
      )
    })

    it('tracks per-apartment token ids independently of global ids', async () => {
      await createApartment(contract, host, { name: 'Second Apartment' })
      await addRoomType(contract, host, 2)

      const dates = await futureDates(1)
      const cost = bookingCost(ROOM.price, 1, 1)
      await contract.connect(tenant).bookApartment(aid, roomIdx, 1, dates, { value: cost.value })
      await contract.connect(tenant).bookApartment(2, roomIdx, 1, dates, { value: cost.value })

      const b1 = (await contract.getBookings(aid))[0]
      const b2 = (await contract.getBookings(2))[0]
      expect(b1.apartmentTokenId).to.equal(1n)
      expect(b2.apartmentTokenId).to.equal(1n) // first token of its own apartment
      expect(b2.tokenId).to.equal(b1.tokenId + 1n) // but global ids increment
    })
  })
})
