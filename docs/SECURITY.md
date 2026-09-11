# V3 security model

## Trust and release boundary

`HospitalityBooking` is immutable. Admin, pauser, and arbitrator roles are
assigned at construction and must be production multisigs. The arbitrator can
select only a full guest refund or the predefined host payout for an unsettled
dispute. Mainnet deployment is prohibited before an independent audit.

The V1 and V2 contracts remain historical artifacts. Their native-token push
payments, host/guest timing races, arbitrary timestamp inventory, transferable
NFT semantics, review model, deletion behavior, and sparse pagination are not
claims about V3 safety and are not used for new writes.

## V3 controls

- Dates are `[checkInDay, checkOutDay)` UTC epoch-day integers, limited to 90 nights.
- Each booking snapshots host, price, schedule, dates, and escrow amount.
- Check-in requires a guest-bound, chain-bound, single-use host EIP-712 signature.
- No-show becomes callable only after the complete check-in window closes.
- Settlement creates pull-payment credits; failed withdrawal transfers do not erase credit.
- `activeEscrow + pendingWithdrawals` is tracked, and only provable excess is recoverable.
- Listings and rooms are deactivated; historical bookings are never deleted.
- Booking NFTs reject approvals and transfers, while mint and burn remain possible.
- Reviews are one-per-booking and bind rating, IPFS URI, reviewer, timestamp, and canonical JSON hash.
- Read pages address exact arrays and cap work and returned entries at 50.
- `Pausable`, `ReentrancyGuard`, `SafeERC20`, `AccessControl`, and custom errors reduce emergency and integration risk.

## Pinning boundary

`pages/api/pinata/pin.js` requires a verified SIWE JWT session, exact same
origin, a CSRF header, and Redis wallet/IP quotas. Production fails closed when
Redis is unavailable. Images are limited to 8 MB and JPEG/PNG/WebP/AVIF with
signature validation; canonical V3 JSON schemas are limited to 64 KB. Provider
requests time out and provider internals are never returned.

## Proof limitations

Payment proof means the configured token entered escrow. Check-in attestation
means the snapshotted host signed and the snapshotted guest submitted the
authorization within its window. It does not independently establish GPS,
identity, physical presence, room access, or review truth. Sybil resistance and
real-world enforcement remain off-chain concerns.

## Invariants and commands

```bash
npm run test:contracts
forge test -vvv
npm run test:unit
npm audit --omit=dev
npm run test:slither
```

Required invariants:

1. `paymentToken.balanceOf(V3) >= totalActiveEscrow + totalPendingWithdrawals`.
2. Per-day occupied rooms never exceed the snapshotted room-type capacity rule.
3. Escrow is removed exactly once, at one terminal settlement path.
4. Check-in nonces and booking review flags are consumed at most once.
5. Every read page does work bounded by its maximum page size.
