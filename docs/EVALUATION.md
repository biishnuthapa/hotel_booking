# Evaluation artifacts → paper sections

This directory holds historical V1/V2 empirical evidence plus V3 verification.
Historical prototype results are not an audit or a production-correctness claim.

## What exists now

| Artifact | Command | Feeds paper section |
|---|---|---|
| Historical V1 unit suite | `_superseded/test/HospitalityBookingNFT.test.js` | Historical implementation |
| Historical V2 suite | `_superseded/test/HospitalityBookingNFTV2.test.js` | Historical optimization |
| Historical randomized fuzzer | `_superseded/test/Invariants.test.js` | Historical correctness evidence |
| Per-op gas + fiat benchmark | `npx hardhat run scripts/benchmark.js` | Evaluation — cost |
| V2 (optimized) benchmark | `BENCH_CONTRACT=V2 npx hardhat run scripts/benchmark.js` | Evaluation — optimization |
| V1↔V2 comparison table | `node scripts/compare-benchmarks.js` | Evaluation — optimization |
| Static-analysis findings | `docs/SECURITY.md` | Security analysis |
| V3 contract suites | `npm run test:contracts` | V3 remediation |
| V3 Foundry invariants | `npm run test:foundry` | V3 liabilities/capacity |
| API/React units | `npm run test:unit` | V3 frontend and upload boundary |

Outputs land in `../benchmarks/` (JSON + paper-ready Markdown tables).

## Headline results (hardhat, 5 iterations)

- **Storage optimization:** moving static listing content off-chain (V1's 9
  on-chain strings → V2's 4) cuts `createAppartment` gas by **~48%**
  (716,798 → 373,567) and deployment by ~10%, with **zero change** to
  booking/settlement gas — the optimization is isolated to listing storage.
- **Read scaling:** V1's unbounded `getApartments()` grows linearly and reaches
  ~4.03M gas at 100 listings. V2 is flat only in the measured dense-listing
  benchmark; filtering deleted IDs means its scan work is not strictly bounded
  by returned page size. V3 exact ID arrays enforce a page cap of 50.
- **Disintermediation cost argument:** a full booking's on-chain cost is a few
  cents on L2 (Polygon/Arbitrum rows in the table) versus the 15–30% commission
  charged by centralized OTAs — the paper's core economic claim, now with
  measured numbers.
- **Safety:** funds-conservation, capacity, and NFT-consistency invariants hold
  across randomized trajectories on two seeds; contract fully drains to zero
  after settlement (no stuck funds).

## Still needed before submission (not yet done)

1. **Re-run benchmarks on Polygon Amoy** for real gas-price and latency data — the
   current numbers are from the in-process hardhat VM.
2. **Related-work comparison table** vs. KER-2020, IEEE-2024, Springer-2025
   systems and industry (Travala, LockTrip).
3. **Threat-model / limitations section** engaging the "misguided development"
   critique (price volatility, UX, custody, regulation).
4. **Figures**: architecture diagram, booking-lifecycle state machine,
   gas-vs-N plot.
5. **Reproducibility appendix**: use the pinned Node 22/npm toolchain and clean CI.

## Future work (out of scope for this paper)

- **Fiat-denominated pricing + multi-currency payment.** Display USD equivalents
  and let guests pay in their preferred token. Natural extensions but deliberately
  deferred: (a) on-chain USD pricing needs a price oracle (the Chainlink POL/USD
  feed on Amoy, `0x001382…5D43`, was non-responsive when tested, so it is not
  demonstrable on the testnet today); (b) accepting arbitrary tokens needs DEX
  routing (no meaningful testnet liquidity) or cross-chain bridges. Both add
  attack surface (oracle manipulation, swap slippage/MEV, token-callback
  reentrancy) that would require re-auditing, so they are documented as future
  work rather than implemented — keeping the evaluated core fully verifiable
  on-chain.
- V3 now implements pull-payment settlement and multisig arbitration. The Amoy
  soak is active; its full 14-day result and the independent audit remain
  release requirements.
