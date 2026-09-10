/**
 * Randomized invariant tests (model-based fuzzing).
 *
 * A JS reference model mirrors the contract's expected escrow ledger and
 * per-date inventory. After every randomized operation we assert:
 *
 *   I1 (funds conservation): contract balance == sum over Booked bookings of
 *       (totalPrice + securityFee) — no ETH is ever created, lost, or stuck.
 *   I2 (capacity safety): roomTypeBookedOnDate never exceeds room capacity
 *       for any date ever touched — double booking is impossible.
 *   I3 (status/NFT consistency): a booking holds a live NFT iff it is not
 *       Cancelled.
 *
 * The PRNG is seeded so failures are reproducible; set FUZZ_SEED / FUZZ_OPS
 * env vars to explore other trajectories.
 */
const { expect } = require('chai')
const { ethers, network } = require('hardhat')

const toWei = (num) => ethers.parseEther(num.toString())

const TAX_PERCENT = 7
const SECURITY_FEE = 5
const DAY = 24 * 60 * 60
const STATUS = { Booked: 0, Cancelled: 1, CheckedIn: 2, Expired: 3 }

const SEED = Number(process.env.FUZZ_SEED || 42)
const OPS = Number(process.env.FUZZ_OPS || 150)

// Deterministic PRNG (mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe(`Invariants (seed=${SEED}, ops=${OPS})`, () => {
  it('holds funds-conservation, capacity, and NFT-consistency invariants under random operations', async function () {
    this.timeout(300000)
    const rand = mulberry32(SEED)
    const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1))
    const pick = (arr) => arr[Math.floor(rand() * arr.length)]

    const [deployer, hostA, hostB, t1, t2, t3] = await ethers.getSigners()
    const tenants = [t1, t2, t3]
    const contract = await ethers.deployContract('HospitalityBookingNFT', [
      TAX_PERCENT,
      SECURITY_FEE,
    ])
    await contract.waitForDeployment()

    // Two apartments, two room types each, differing price/capacity.
    const apartments = [
      { aid: 1, host: hostA, roomTypes: [{ price: 1, capacity: 2 }, { price: 2, capacity: 4 }] },
      { aid: 2, host: hostB, roomTypes: [{ price: 3, capacity: 1 }, { price: 1, capacity: 3 }] },
    ]
    for (const apt of apartments) {
      await contract
        .connect(apt.host)
        .createAppartment(
          `Apartment ${apt.aid}`,
          'desc',
          'loc',
          'img',
          4,
          '0',
          '0',
          'ipfs://meta',
          'NFT',
          'nftdesc',
          'ipfs://img'
        )
      for (const [i, rt] of apt.roomTypes.entries()) {
        await contract
          .connect(apt.host)
          .addRoomTypeToApartment(apt.aid, `RT${i}`, 'rt desc', toWei(rt.price), 'img', rt.capacity)
      }
    }

    // ---- Reference model ----
    // bookings: { aid, id, tenant, roomTypeIndex, rooms, dates[], totalPrice, fee, status }
    const model = { bookings: [], inventory: new Map() } // inventory key `${aid}:${rt}:${date}` -> count
    const invKey = (aid, rt, date) => `${aid}:${rt}:${date}`

    const now = async () => Number((await ethers.provider.getBlock('latest')).timestamp)

    async function assertInvariants() {
      // I1: funds conservation
      let expectedBalance = 0n
      for (const b of model.bookings) {
        if (b.status === STATUS.Booked) expectedBalance += b.totalPrice + b.fee
      }
      const actual = await ethers.provider.getBalance(await contract.getAddress())
      expect(actual, 'I1 funds conservation').to.equal(expectedBalance)

      // I2: capacity safety, and model/chain inventory agreement
      for (const [key, count] of model.inventory) {
        const [aid, rt, date] = key.split(':').map(Number)
        const onChain = await contract.roomTypeBookedOnDate(aid, rt, date)
        expect(onChain, `I2 inventory mismatch at ${key}`).to.equal(BigInt(count))
        const capacity = apartments.find((a) => a.aid === aid).roomTypes[rt].capacity
        expect(count, `I2 capacity exceeded at ${key}`).to.be.at.most(capacity)
      }

      // I3: NFT consistency
      for (const b of model.bookings) {
        const onChain = (await contract.getBookings(b.aid))[b.id]
        expect(Number(onChain.status), `I3 status of ${b.aid}/${b.id}`).to.equal(b.status)
        if (b.status === STATUS.Cancelled) {
          expect(onChain.tokenId, 'I3 cancelled booking must have no token').to.equal(0n)
        } else {
          const owner = await contract.ownerOf(onChain.tokenId) // reverts if token missing
          expect(owner, 'I3 live token must have an owner').to.properAddress
        }
      }
    }

    // ---- Operations ----
    async function opBook() {
      const apt = pick(apartments)
      const rt = randInt(0, apt.roomTypes.length - 1)
      const { price, capacity } = apt.roomTypes[rt]
      const rooms = randInt(1, capacity)
      const nights = randInt(1, 3)
      const tenant = pick(tenants)
      const start = (await now()) + randInt(1, 20) * DAY + randInt(0, 3600)
      const dates = Array.from({ length: nights }, (_, i) => start + i * DAY)

      // Predict from model whether it fits
      const fits = dates.every(
        (d) => (model.inventory.get(invKey(apt.aid, rt, d)) || 0) + rooms <= capacity
      )
      const totalPrice = toWei(price * rooms * nights)
      const fee = (totalPrice * BigInt(SECURITY_FEE)) / 100n

      const call = contract
        .connect(tenant)
        .bookApartment(apt.aid, rt, rooms, dates, { value: totalPrice + fee })

      if (!fits) {
        await expect(call, 'model predicted full').to.be.revertedWith('Room type full')
        return
      }
      await call
      for (const d of dates) {
        const k = invKey(apt.aid, rt, d)
        model.inventory.set(k, (model.inventory.get(k) || 0) + rooms)
      }
      model.bookings.push({
        aid: apt.aid,
        id: (await contract.getBookings(apt.aid)).length - 1,
        tenant,
        roomTypeIndex: rt,
        rooms,
        dates,
        totalPrice,
        fee,
        status: STATUS.Booked,
      })
    }

    async function opRefund() {
      const candidates = model.bookings.filter(
        async (b) => b.status === STATUS.Booked
      )
      const active = []
      const t = await now()
      for (const b of model.bookings) {
        if (b.status === STATUS.Booked && b.dates[0] > t) active.push(b)
      }
      if (!active.length) return
      const b = pick(active)
      await contract.connect(b.tenant).refundBooking(b.aid, b.id)
      b.status = STATUS.Cancelled
      for (const d of b.dates) {
        const k = invKey(b.aid, b.roomTypeIndex, d)
        model.inventory.set(k, Math.max(0, (model.inventory.get(k) || 0) - b.rooms))
      }
    }

    async function opAdvanceTimeAndSettle() {
      const jump = randInt(1, 3) * DAY
      await network.provider.send('evm_increaseTime', [jump])
      await network.provider.send('evm_mine')
      const t = await now()

      for (const b of model.bookings) {
        if (b.status !== STATUS.Booked) continue
        const start = b.dates[0]
        if (t >= start && t <= start + DAY && rand() < 0.5) {
          await contract.connect(b.tenant).checkInApartment(b.aid, b.id)
          b.status = STATUS.CheckedIn
        } else if (t > start && rand() < 0.3) {
          const host = apartments.find((a) => a.aid === b.aid).host
          await contract.connect(host).claimFunds(b.aid, b.id)
          b.status = STATUS.Expired
        }
      }
    }

    // ---- Drive ----
    const weights = [
      [0.55, opBook],
      [0.25, opRefund],
      [0.2, opAdvanceTimeAndSettle],
    ]
    for (let i = 0; i < OPS; i++) {
      const r = rand()
      let acc = 0
      for (const [w, op] of weights) {
        acc += w
        if (r < acc) {
          await op()
          break
        }
      }
      await assertInvariants()
    }

    // Final sweep: settle everything and confirm the contract can be fully drained.
    await network.provider.send('evm_increaseTime', [40 * DAY])
    await network.provider.send('evm_mine')
    for (const b of model.bookings) {
      if (b.status !== STATUS.Booked) continue
      const host = apartments.find((a) => a.aid === b.aid).host
      await contract.connect(host).claimFunds(b.aid, b.id)
      b.status = STATUS.Expired
    }
    await assertInvariants()
    expect(
      await ethers.provider.getBalance(await contract.getAddress()),
      'contract fully drained after settlement — no stuck funds'
    ).to.equal(0n)
  })
})
