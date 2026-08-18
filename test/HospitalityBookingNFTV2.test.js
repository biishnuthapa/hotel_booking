const { expect } = require('chai')
const { ethers, network } = require('hardhat')

const toWei = (num) => ethers.parseEther(num.toString())

const TAX_PERCENT = 7
const SECURITY_FEE = 5
const DAY = 24 * 60 * 60
const STATUS = { Booked: 0, Cancelled: 1, CheckedIn: 2, Expired: 3 }

async function futureDates(count, offsetDays = 1) {
  const block = await ethers.provider.getBlock('latest')
  const start = Number(block.timestamp) + offsetDays * DAY
  return Array.from({ length: count }, (_, i) => start + i * DAY)
}

function bookingCost(priceEth, rooms, nights) {
  const totalPrice = toWei(priceEth * rooms * nights)
  const fee = (totalPrice * BigInt(SECURITY_FEE)) / 100n
  return { totalPrice, fee, value: totalPrice + fee }
}

describe('HospitalityBookingNFTV2', () => {
  let contract
  let deployer, host, tenant
  const aid = 1
  const PRICE = 1

  beforeEach(async () => {
    ;[deployer, host, tenant] = await ethers.getSigners()
    contract = await ethers.deployContract('HospitalityBookingNFTV2', [TAX_PERCENT, SECURITY_FEE])
    await contract.waitForDeployment()
    await contract
      .connect(host)
      .createAppartment('Lakeside V2', 'Laramie', 'ipfs://img', 'ipfs://meta', 4)
    await contract
      .connect(host)
      .addRoomTypeToApartment(aid, 'Deluxe', 'Two queens', toWei(PRICE), 'img', 3)
  })

  it('stores slim apartment struct with metadataURI', async () => {
    const apt = await contract.getApartment(aid)
    expect(apt.name).to.equal('Lakeside V2')
    expect(apt.imageURI).to.equal('ipfs://img')
    expect(apt.metadataURI).to.equal('ipfs://meta')
    expect(apt.owner).to.equal(host.address)
  })

  it('full lifecycle: book -> check-in -> payout parity with V1 escrow math', async () => {
    const dates = await futureDates(2)
    const cost = bookingCost(PRICE, 1, 2)
    await contract.connect(tenant).bookApartment(aid, 0, 1, dates, { value: cost.value })

    await network.provider.send('evm_setNextBlockTimestamp', [dates[0] + 60])
    await network.provider.send('evm_mine')

    const tax = (cost.totalPrice * BigInt(TAX_PERCENT)) / 100n
    await expect(contract.connect(tenant).checkInApartment(aid, 0)).to.changeEtherBalances(
      [host, deployer, contract],
      [cost.totalPrice - tax, tax, -(cost.totalPrice + cost.fee)]
    )
    const booking = (await contract.getBookings(aid))[0]
    expect(Number(booking.status)).to.equal(STATUS.CheckedIn)
    await expect(contract.connect(tenant).addReview(aid, 'Great')).to.not.be.reverted
  })

  it('refund burns NFT and reopens inventory', async () => {
    const dates = await futureDates(1)
    const cost = bookingCost(PRICE, 2, 1)
    await contract.connect(tenant).bookApartment(aid, 0, 2, dates, { value: cost.value })
    const tokenId = (await contract.getBookings(aid))[0].tokenId

    await contract.connect(tenant).refundBooking(aid, 0)
    await expect(contract.ownerOf(tokenId)).to.be.reverted
    expect(await contract.roomTypeBookedOnDate(aid, 0, dates[0])).to.equal(0n)
  })

  it('tokenURI embeds dynamic attributes and off-chain metadata pointers', async () => {
    const dates = await futureDates(1)
    const cost = bookingCost(PRICE, 1, 1)
    await contract.connect(tenant).bookApartment(aid, 0, 1, dates, { value: cost.value })
    const tokenId = (await contract.getBookings(aid))[0].tokenId

    const uri = await contract.tokenURI(tokenId)
    const json = JSON.parse(Buffer.from(uri.split('base64,')[1], 'base64').toString('utf8'))
    expect(json.image).to.equal('ipfs://img')
    expect(json.external_url).to.equal('ipfs://meta')
    const attrs = Object.fromEntries(json.attributes.map((a) => [a.trait_type, a.value]))
    expect(attrs['Status']).to.equal(String(STATUS.Booked))
    expect(attrs['CheckInDate']).to.equal(String(dates[0]))
  })

  describe('pagination', () => {
    beforeEach(async () => {
      for (let i = 2; i <= 12; i++) {
        await contract
          .connect(host)
          .createAppartment(`Apt ${i}`, 'Laramie', 'ipfs://img', 'ipfs://meta', 2)
      }
      // delete one mid-range apartment
      await contract.connect(host).deleteAppartment(5)
    })

    it('walks all non-deleted apartments across pages without duplicates', async () => {
      const seen = []
      let cursor = 0n
      do {
        const [page, next] = await contract.getApartmentsPaged(cursor, 5)
        for (const apt of page) seen.push(Number(apt.id))
        cursor = next
      } while (cursor !== 0n)

      expect(seen).to.deep.equal([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12])
    })

    it('bounds page size and rejects invalid limits', async () => {
      const [page] = await contract.getApartmentsPaged(0, 3)
      expect(page.length).to.equal(3)
      await expect(contract.getApartmentsPaged(0, 0)).to.be.revertedWith('Limit must be 1-100')
      await expect(contract.getApartmentsPaged(0, 101)).to.be.revertedWith('Limit must be 1-100')
    })

    it('paginates owned tokens', async () => {
      const dates = await futureDates(1)
      const cost = bookingCost(PRICE, 1, 1)
      await contract.connect(tenant).bookApartment(aid, 0, 1, dates, { value: cost.value })
      const dates2 = await futureDates(1, 2)
      await contract.connect(tenant).bookApartment(aid, 0, 1, dates2, { value: cost.value })

      const [page, next] = await contract.getOwnedTokensPaged(tenant.address, 0, 10)
      expect(page.length).to.equal(2)
      expect(next).to.equal(0n)
    })
  })
})
