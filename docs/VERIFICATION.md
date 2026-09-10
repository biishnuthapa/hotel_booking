# V3 verification status

This report replaces the earlier unconditional V1 correctness statement. V1
and V2 test results are historical evidence only and do not establish production
safety. V3 mainnet is not approved and no independent audit has been completed.

## Automated status

| Layer | Coverage |
|---|---|
| Solidity units | Dates, capacity, deactivation, EIP-712 domain/guest/host/nonce/time failures, no-show boundary, completion, accounting, withdrawal failure, disputes, NFT/review/pause/page behavior |
| Randomized legacy suite | Preserved to prevent accidental V1 source-build regressions |
| Foundry | Liability, active-escrow, capacity, single terminal settlement, authorization/review single-use, and bounded-pagination invariants under handler actions |
| API units | Missing SIWE, origin, MIME spoofing, sizes, quotas, Redis failure, Pinata failure/timeout |
| React/utilities | UTC date conversion, exclusive range construction, canonical review hash, Legacy V1 separation |
| Playwright/local chain | Create listing, book, host sign, guest check-in, withdraw, complete, cancel, no-show, review, dispute, and V3/legacy navigation |
| CI | Lint, types, production build, units, contracts, coverage, Foundry, Slither, production dependency audit, E2E, and secret scanning |

## Semantics verified

- A booking payment proves exact receipt of the configured ERC-20 amount.
- A checked-in status proves a valid host EIP-712 attestation was submitted by
  the bound guest during the snapshotted window.
- Neither state proves physical presence. The UI and paper must not describe it
  as unconditional physical proof.
- Checkout is the exclusive end date; consecutive ranges do not overlap.
- No-show is impossible at every timestamp through and including the deadline.
- V1 remains readable with no V1 transaction controls in the active routes.

## Release evidence still required

1. Rotate all compromised/exposed credentials and document wallet asset migration.
2. Coordinate and verify the `.env` history rewrite.
3. Deploy V3 and mock USDC to Amoy and publish verified addresses and deployment block.
4. Complete at least 14 days of multi-wallet soak testing and archive monitoring results.
5. Freeze the commit, artifact hash, constructor arguments, compiler settings, and bytecode evidence.
6. Obtain an independent audit; close all critical/high findings and record accepted medium findings.
7. Assign treasury/admin/pauser/arbitrator to reviewed multisigs.
8. Only then set the guarded mainnet release variables and deploy.
