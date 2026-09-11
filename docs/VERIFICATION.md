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

Current local result on Node 22: ESLint and type checking pass; 16 Vitest tests,
37 Hardhat tests, two Playwright lifecycle tests, and six Foundry invariants pass.
The production dependency audit reports zero vulnerabilities, the production
Next.js build succeeds, and Slither reports no high-severity findings.
The full development dependency tree has no critical, high, or moderate findings;
its remaining low advisories are confined to Hardhat 2's development-only
toolchain, for which npm currently reports no non-breaking fully patched path.
These packages are excluded from the production bundle.

## Polygon Amoy deployment

Deployment of the final contract revision is pending and will be performed
manually. The September 11 addresses were superseded by later source changes;
their deployment record has been removed from the active release state so the
frontend cannot accidentally treat them as current. No V3 address is used unless
it is supplied explicitly through environment configuration.

After the final deployment, run `npm run verify:amoy`, commit the regenerated
`contracts/deployments/80002.json`, configure the frontend from that record, and
start a new 14-day soak with `npm run soak:start:amoy`.

## Compromised-wallet asset migration

The native balances of both addresses derived from historically committed keys
were swept to the current deployment wallet and then rechecked as zero:

- [Amoy migration transaction](https://amoy.polygonscan.com/tx/0x09ba9dc24c89de0a7a9017ac0163bc2c333c298f1e9b78ff38f21751bdf4dc39)
- [Polygon migration transaction](https://polygonscan.com/tx/0xc4fe3fd8990de51d2d77b6f5b4c36a5f2ad0b31a5e89f63a760e682c71d26138)

This moves on-chain native assets only. Revoking/reissuing Pinata,
WalletConnect, hosted NextAuth, Redis, RPC, and explorer credentials still
requires access to their provider accounts.

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

1. Rotate all compromised/exposed external credentials and document completion.
2. Have every collaborator back up and approve the coordinated `.env` history rewrite.
3. Deploy the final revision to Amoy, verify it, and configure the frontend with
   the newly generated addresses and deployment block.
4. Complete a new 14-day soak and archive its monitoring results.
5. Commit the release candidate, freeze its audit manifest, and commission an independent audit.
6. Close all critical/high audit findings and record accepted medium findings.
7. Provide reviewed multisig addresses for treasury/admin/pauser/arbitrator.
8. Only then set the guarded mainnet release variables and deploy.
