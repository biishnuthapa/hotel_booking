# End-to-End Logic Verification Report

**System:** HospitalityBookingNFT (dappBnb-derived Web3 hotel booking)
**Date:** 2026-07-23
**Networks:** Local Hardhat (exhaustive) + Polygon Amoy testnet (live, publicly verifiable)

---

## 1. Executive summary

**Every core logic path works.** No smart-contract bugs were found. All money
flows, status transitions, and access-control rules behave as designed, verified
two ways: 36 local tests with exact assertions, and real transactions on Polygon
Amoy that anyone can inspect on PolygonScan.

| Area | Verdict |
|------|---------|
| Booking + NFT minting | ✅ Works |
| Cancellation / refund (+ NFT burn) | ✅ Works |
| Check-in + fund split | ✅ Works |
| No-show claim + fund split | ✅ Works |
| Checkout | ✅ Works |
| Review gating (proof-of-stay) | ✅ Works |
| Dynamic NFT status (Booked→CheckedIn→Expired/Cancelled) | ✅ Works, on-chain |
| Fund conservation (no stuck funds) | ✅ Verified — contract drains to 0 |
| Role-based access control | ✅ Works (local suite) |
| Frontend read path (reads live Amoy data) | ✅ Works |
| Frontend currency label shows "ETH" on Amoy | ⚠️ Cosmetic bug |
| Unbounded `getApartments`/`getOwnedTokens` scaling | ⚠️ Known limitation (fixed in V2) |

**No issues in the contract's economic or state logic.** The only findings are
one cosmetic frontend label and a previously-documented read-scaling limitation.

---

## 2. Method (why two layers)

- **Local Hardhat suite (36 tests + invariant fuzzer):** uses 20 distinct
  accounts, so it can prove *negative* access-control rules (e.g. "a stranger
  cannot check in") and assert **exact** wei-level fund splits via
  `changeEtherBalances`. This is the correctness backbone.
- **Polygon Amoy (live):** the same flows executed as real transactions across
  **three separate real wallets** (admin/host/tenant), proving it works on a
  public chain with real gas, real confirmations, and publicly auditable state.

---

## 3. Roles verified

| Role | Address (Amoy) | Powers exercised |
|------|----------------|------------------|
| **ADMIN / platform** (`owner()`) | `0x4Db46B9F…D5de27` | Receives tax on every settlement; deploys; can force-refund (dispute lever) |
| **HOST** (apartment owner) | `0xfBB2C634…923B7f` (multi-role run) | Create listing, add room types, checkout, claim no-show funds |
| **TENANT** (guest) | `0x9fc53b13…1220e1` (multi-role run) | Book, cancel/refund, check-in, review |

---

## 4. Booking lifecycle — on-chain proof

Two live contracts on Amoy were used:

- **Primary demo:** [`0x630dbDfa…17768E`](https://amoy.polygonscan.com/address/0x630dbDfa393bAd0c364E1AE559Cee5A6ED17768E)
- **Multi-role:** [`0x99b6668d…5B116c`](https://amoy.polygonscan.com/address/0x99b6668dB9A93EE2440442feD8763dFaD95B116c)

### NFT status transitions (all confirmed live)

| Transition | Trigger | Token | Proof (Amoy tx) |
|------------|---------|-------|-----------------|
| — → **Booked (0)** | `bookApartment` | all | [book](https://amoy.polygonscan.com/tx/0x064445981cb3115505d40bfce799704700012d6fa26098e3410747d7de4a60cc) |
| Booked → **CheckedIn (2)** | `checkInApartment` | #2 | [check-in](https://amoy.polygonscan.com/tx/0x9ad1b7d5deb14f374e324d9396443bc5c2d9940508b9394854e6d935883c374f) |
| CheckedIn → **Expired (3)** | `checkout` | #2 | [checkout](https://amoy.polygonscan.com/tx/0x24fe9f04f911b5cea1e939f4a05f766109aea8ff74cc3ec48117f824dbcdbc3d) |
| Booked → **Expired (3)** | `claimFunds` (no-show) | #3 | [claim](https://amoy.polygonscan.com/tx/0x244546bb59c0efe0b34a27f9aa238475be3f8bf07e8b8cad1a6a1b2bb64e8118) |
| Booked → **Cancelled (1)** + NFT burned | `refundBooking` | #0 | multi-role contract `0x99b6…` booking #1 now `Cancelled`, tokenId reset to 0 |

The status is read live from each token's on-chain `tokenURI` (base64 JSON),
regenerated from contract state on every read — **no metadata server, no re-mint.**
This is the dynamic proof-of-stay mechanism working on a public chain.

---

## 5. Fund flows (exact splits)

Parameters: **tax = 7%** (to platform), **security fee = 5%** (refundable deposit).
For a 1-night booking at price **P**, the tenant pays **1.05P** (P + 5% fee).
Splits below are asserted to the wei in the local suite and confirmed executing on Amoy.

| Event | Host receives | Platform (admin) receives | Tenant receives | Conserved? |
|-------|---------------|---------------------------|-----------------|------------|
| **Check-in** | 0.93P (P − tax) | 0.07P (tax) | 0.05P (deposit back) | ✅ = 1.05P |
| **No-show claim** | 0.98P (P − tax + fee) | 0.07P (tax) | 0 (forfeits deposit) | ✅ = 1.05P |
| **Refund (cancel)** | 0.025P (½ fee) | 0.025P (½ fee) | P (full price back) | ✅ = 1.05P |

**Interpretation:**
- On a completed stay, the guest's 5% deposit is returned; the host keeps the
  nightly price minus the platform's 7% tax.
- On a no-show, the guest forfeits the 5% deposit to the host as compensation.
- On a cancellation, the guest gets the full price back but forfeits the 5%
  deposit, split evenly between host and platform.

**Fund conservation, proven live:** after all settlements, demo contract
`0x630d…` holds **exactly 0.0 POL** — every wei paid in was paid out, nothing
stuck. The multi-role contract `0x99b6…` correctly still holds **0.00021 POL**,
which is precisely the escrow of its one booking that was left unsettled. Both
match the ledger exactly.

---

## 6. Access-control matrix (local suite)

Each negative below is an actual failing-as-expected test:

| Rule | Enforced? |
|------|-----------|
| Only apartment owner can update/delete listing or add/delete room types | ✅ |
| Booking payment must equal exactly price + fee (not more, not less) | ✅ |
| No double-booking: per-date room count can't exceed capacity | ✅ |
| Only the booking's tenant can check in | ✅ |
| Check-in only within the [stay start, +24h] window | ✅ |
| Only apartment owner can checkout / claim no-show funds | ✅ |
| Refund only by tenant (before stay) or platform owner; not strangers | ✅ |
| No refund of a checked-in booking; no double-refund | ✅ |
| Reviews only from addresses that have completed a check-in | ✅ |
| `tokenURI` reverts for burned/nonexistent tokens | ✅ |

---

## 7. Frontend verification

- **Read path:** ✅ The app was repointed to the Amoy contract and the homepage
  correctly renders the live on-chain listing ("Lakeside Meadow Apartment"),
  read straight from `0x630d…`. No console errors.
- **Network handling:** ✅ Made network-aware — MetaMask is prompted to
  switch/add **Polygon Amoy** with correct POL currency and explorer.
- **Write path (book/check-in/etc. via UI):** the UI calls the *same* contract
  functions verified above through `services/blockchain.jsx`. The contract-level
  behavior is fully proven; a full click-through with MetaMask signing was not
  automated here.

### Frontend issue found
⚠️ **Currency label:** price displays hardcode "ETH" (e.g. "0.0001 ETH/night")
even on Amoy where the token is POL. Cosmetic only — no effect on logic. Fix:
derive the symbol from the active chain.

---

## 8. Issues found

| # | Severity | Where | Status |
|---|----------|-------|--------|
| 1 | **None (logic)** | Smart contract | No economic or state bugs found across all paths |
| 2 | Cosmetic | Frontend price label | "ETH" shown on Amoy; should be POL. Open. |
| 3 | Known | `getApartments`/`getOwnedTokens` unbounded loops | Scaling limit; **fixed in V2** (pagination) |

### Verification-harness notes (not product bugs)
- The first multi-role Amoy script crashed at `addReview` because the tenant
  wallet ran low on gas, and used throwaway in-memory wallets, stranding
  ~0.04 test-POL. Fixed with explicit funding + a `finally` sweep in later runs.
- A public-RPC nonce-lag caused one "nonce too low" error; fixed with explicit
  nonce management. These are testnet-tooling issues, not contract issues.

---

## 9. Evidence index

- Local suite: `npx hardhat test` → 36 passing
- Invariant fuzzer: `test/Invariants.test.js` (funds conservation, capacity, NFT consistency)
- Amoy demo: `scripts/demo-amoy-result.json`
- Amoy finish (review/checkout/no-show): `scripts/verify-amoy-finish-result.json`
- Contracts on Amoy:
  - [`0x630dbDfa…17768E`](https://amoy.polygonscan.com/address/0x630dbDfa393bAd0c364E1AE559Cee5A6ED17768E)
  - [`0x99b6668d…5B116c`](https://amoy.polygonscan.com/address/0x99b6668dB9A93EE2440442feD8763dFaD95B116c)
