const { expect } = require('chai')
const { ethers } = require('hardhat')

const toWei = (num) => ethers.parseEther(num.toString())

describe('HospitalityBookingNFT', () => {
  let contract
  let deployer
  let host
  let tenant

  const id = 1
  const taxPercent = 7
  const securityFee = 5
  const name = 'First apartment'
  const location = 'Laramie'
  const description = 'Nice place'
  const images = 'ipfs://images'
  const latitude = '41.3114'
  const longitude = '-105.5911'
  const pinataJsonLink = 'ipfs://metadata'
  const rooms = 2
  const price = 1

  beforeEach(async () => {
    ;[deployer, host, tenant] = await ethers.getSigners()
    contract = await ethers.deployContract('HospitalityBookingNFT', [taxPercent, securityFee])
    await contract.waitForDeployment()

    await contract
      .connect(host)
      .createAppartment(
        name,
        description,
        location,
        images,
        rooms,
        toWei(price),
        latitude,
        longitude,
        pinataJsonLink
      )
  })

  async function futureDates(count) {
    const block = await ethers.provider.getBlock('latest')
    const start = Number(block.timestamp) + 24 * 60 * 60
    const dates = []
    for (let i = 0; i < count; i++) {
      dates.push(start + i * 24 * 60 * 60)
    }
    return dates
  }

  it('books apartment with exact payment and marks dates unavailable', async () => {
    const dates = await futureDates(2)
    const totalPrice = toWei(price * dates.length)
    const fee = (totalPrice * BigInt(securityFee)) / 100n
    const amount = totalPrice + fee

    await contract.connect(tenant).bookApartment(id, dates, { value: amount })

    const bookings = await contract.getBookings(id)
    expect(bookings.length).to.equal(2)
    expect(bookings[0].date).to.equal(dates[0])
    expect(bookings[1].date).to.equal(dates[1])
  })

  it('rejects duplicate dates in one booking request', async () => {
    const dates = await futureDates(1)
    const dup = [dates[0], dates[0]]
    const totalPrice = toWei(price * dup.length)
    const fee = (totalPrice * BigInt(securityFee)) / 100n
    const amount = totalPrice + fee

    await expect(
      contract.connect(tenant).bookApartment(id, dup, { value: amount })
    ).to.be.revertedWith('Duplicate dates in request')
  })

  it('rejects claims before booking date', async () => {
    const dates = await futureDates(1)
    const totalPrice = toWei(price)
    const fee = (totalPrice * BigInt(securityFee)) / 100n
    const amount = totalPrice + fee

    await contract.connect(tenant).bookApartment(id, dates, { value: amount })

    await expect(contract.connect(host).claimFunds(id, 0)).to.be.revertedWith(
      'Cannot claim before booking date'
    )
  })

  it('refund marks booking cancelled and reopens date', async () => {
    const dates = await futureDates(1)
    const totalPrice = toWei(price)
    const fee = (totalPrice * BigInt(securityFee)) / 100n
    const amount = totalPrice + fee

    await contract.connect(tenant).bookApartment(id, dates, { value: amount })
    await contract.connect(tenant).refundBooking(id, 0)

    const booking = await contract.getBooking(id, 0)
    expect(booking.cancelled).to.equal(true)

    const totalPrice2 = toWei(price)
    const fee2 = (totalPrice2 * BigInt(securityFee)) / 100n
    const amount2 = totalPrice2 + fee2

    await contract.connect(tenant).bookApartment(id, [dates[0]], { value: amount2 })
  })

  it('accepts millisecond timestamp booking inputs', async () => {
    const datesSec = await futureDates(1)
    const dateMs = datesSec[0] * 1000
    const totalPrice = toWei(price)
    const fee = (totalPrice * BigInt(securityFee)) / 100n
    const amount = totalPrice + fee

    await contract.connect(tenant).bookApartment(id, [dateMs], { value: amount })

    const booking = await contract.getBooking(id, 0)
    expect(Number(booking.date)).to.equal(datesSec[0])
  })

  it('keeps review eligibility after check-in even if a later booking is refunded', async () => {
    const firstDates = await futureDates(1)
    const totalPriceFirst = toWei(price)
    const feeFirst = (totalPriceFirst * BigInt(securityFee)) / 100n

    await contract.connect(tenant).bookApartment(id, firstDates, { value: totalPriceFirst + feeFirst })

    const latestBeforeCheckIn = await ethers.provider.getBlock('latest')
    const jumpTo = Number(firstDates[0]) - Number(latestBeforeCheckIn.timestamp) + 5
    await ethers.provider.send('evm_increaseTime', [jumpTo])
    await ethers.provider.send('evm_mine')

    await contract.connect(tenant).checkInApartment(id, 0)

    const secondDates = await futureDates(1)
    const totalPriceSecond = toWei(price)
    const feeSecond = (totalPriceSecond * BigInt(securityFee)) / 100n
    await contract.connect(tenant).bookApartment(id, secondDates, { value: totalPriceSecond + feeSecond })

    await contract.connect(tenant).refundBooking(id, 1)

    await expect(contract.connect(tenant).addReview(id, 'Excellent stay')).to.not.be.reverted
  })
})
