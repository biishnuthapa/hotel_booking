# Security Analysis

Static analysis with **Slither 0.11.4** (74 detectors) plus a 29-case unit
suite and a randomized model-based invariant fuzzer (see `test/`). This
document triages every contract-level finding; OpenZeppelin-internal detector
hits (`incorrect-exp`, `divide-before-multiply` in `Math.mulDiv` / `Base64`)
are upstream library false positives and are excluded.

## Method

```bash
pip install slither-analyzer
slither contracts/HospitalityBookingNFT.sol \
  --solc-remaps "@openzeppelin=node_modules/@openzeppelin" \
  --exclude-informational --exclude-optimization
npx hardhat test        # 36 unit + V2 tests
npx hardhat test test/Invariants.test.js   # randomized invariants, 2 seeds
```

## Findings

| # | Severity | Detector | Location | Status | Notes |
|---|----------|----------|----------|--------|-------|
| S1 | Medium | `arbitrary-send-eth` | `payTo()` | **Accepted (guarded)** | All callers (`checkInApartment`, `claimFunds`, `refundBooking`) gate on `msg.sender` role and set booking status **before** paying (checks-effects-interactions). Destinations are the apartment owner, platform owner, or the booking tenant — never attacker-controlled. |
| S2 | Medium | push-payment griefing | `checkInApartment()`, `claimFunds()` | **Documented limitation** | Payouts use `.call` with `require(success)`. If a payee is a contract that reverts on receive, the whole settlement reverts. Recommended fix: pull-payment (accrue balances, `withdraw()`). Not applied to V2 so its gas stays directly comparable to V1. |
| S3 | Low | central-authority refund | `refundBooking()` | **Documented trust assumption** | The platform `owner()` can cancel and refund *any* booking, including after the stay starts. This is an intentional dispute-resolution lever but concentrates trust; a paper must disclose it. A DAO/arbitration upgrade is future work. |
| S4 | Low | `timestamp` | booking lifecycle | **Accepted** | `block.timestamp` gates check-in/refund/claim. Validators can skew timestamps by a few seconds; booking granularity is whole days, so the attack surface is immaterial. |
| S5 | Info→Fixed | `shadowing-local` | `createAppartment`/`updateAppartment` `name` param | **Fixed in V2** | Parameter renamed `apartmentName` so it no longer shadows `ERC721.name()`. One `_name` shadow remains in `addRoomTypeToApartment` (kept identical to V1 to preserve gas-comparison validity; harmless — local param vs. inherited private var). |
| S6 | Info | `uninitialized-local` | struct builders, loop counters | **Accepted** | Solidity zero-initializes; the code relies on this intentionally (e.g. `booking.status` defaults to `Booked=0`). No action needed. |
| S7 | Medium (economic) | self-review collusion | `addReview` gate | **Documented limitation** | A host can book their own listing (optionally via a self-created near-zero-price room type), check in, and post a "verified" review at a cost of roughly tax + gas (≈ gas only with a 1-wei price). The gate guarantees *verified-stay binding* (every review maps to an auditable on-chain booking), not sybil-resistance. Mitigations (min review-eligible value, price floors, value-weighted reviews, identity layer) are future work. See paper §6. |

## Reentrancy

No `reentrancy-eth` / `reentrancy-no-eth` findings. Every fund-moving function
is `nonReentrant` **and** follows checks-effects-interactions (status is
written before any external `.call`). The invariant fuzzer additionally asserts
funds conservation after every operation across randomized trajectories, and
that the contract can always be fully drained to zero after settlement — a
reentrancy or accounting leak would break these.

## Verified invariants (test/Invariants.test.js)

- **I1 Funds conservation** — contract balance always equals the sum of
  `totalPrice + securityFee` over bookings still in `Booked` status.
- **I2 Capacity safety** — `roomTypeBookedOnDate` never exceeds room capacity
  for any date; double-booking is impossible. Cross-checked against a JS
  reference model after every op.
- **I3 NFT consistency** — a booking holds a live ERC-721 iff it is not
  `Cancelled`; cancelled bookings have `tokenId == 0`.

Run across seeds 42 (150 ops) and 1337 (100 ops); both pass. Change with
`FUZZ_SEED` / `FUZZ_OPS`.

## Recommended before mainnet

1. Adopt pull-payments (S2).
2. Replace owner-refund with a timelocked/arbitrated dispute flow (S3).
3. Commission a third-party audit; run Echidna/Foundry invariant campaigns at
   higher depth.
4. Add a circuit-breaker (`Pausable`) for emergency stops.
