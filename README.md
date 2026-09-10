# HospitalityBooking V3

HospitalityBooking V3 is an immutable Polygon booking escrow. New writes use a
single USDC-style ERC-20, UTC epoch-day ranges, host-signed EIP-712 check-in,
pull withdrawals, one review per booking, non-transferable booking passes, and
multisig arbitration. The original V1 deployment is displayed separately and
read-only; its records are not migrated.

## Local development

Requirements: Node 22, npm 10+, and a WalletConnect project ID. Copy
`.env.example` to `.env.local` and do not reuse the historically committed
deployment key.

```bash
nvm use
npm ci --legacy-peer-deps
npx hardhat node
npm run deploy:v3:local
```

Copy the V3 and mock-token addresses from
`contracts/deployments/31337.json` into the local public environment variables,
then run:

```bash
npm run dev
```

SIWE is mandatory in production. Development may set
`NEXT_PUBLIC_ENABLE_SIWE=false` while exercising a local chain, but the pinning
API still requires a wallet session.

## Verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:contracts
npm run test:coverage
npm run build
npm run test:e2e
forge test -vvv
```

The V3 suite covers canonical/exclusive date ranges, interior capacity,
signature replay and domain binding, the complete no-show window, deactivation,
odd-value accounting, failed withdrawals, disputes, pausing, metadata escaping,
review uniqueness, non-transferability, and bounded pages. Foundry invariants
cover liabilities, escrow accounting, capacity, terminal-settlement uniqueness,
authorization/review single-use, and bounded pagination.

## Deployment policy

Amoy is the first release target. `scripts/deploy-v3.js` deploys a mock USDC on
Amoy when no payment token is supplied, writes chain-specific deployment data,
and verifies source when PolygonScan credentials are available.

Polygon mainnet is intentionally blocked. The mainnet command requires both:

- `MAINNET_RELEASE_APPROVED=true`
- an `AUDITED_V3_ARTIFACT_HASH` matching the compiled artifact

Those values may be set only after an independent audit, remediation of all
critical/high findings, documentation of accepted medium findings, a frozen
commit, and a 14-day multi-wallet Amoy soak test. Privileged roles must be
multisigs.

## Security operations still requiring human coordination

The repository cannot rotate external accounts by itself. Before any public
deployment, create a new deployment wallet, move remaining assets from the
compromised wallet, revoke old Pinata credentials, rotate NextAuth,
WalletConnect, Redis, RPC, and API secrets, and coordinate a `git filter-repo`
history rewrite with every collaborator. See `docs/RELEASE.md`.

## Proof terminology

An on-chain payment proves token transfer into escrow. A successful V3 check-in
proves that the snapshotted host signed an authorization which the snapshotted
guest submitted in the allowed window. Neither fact alone proves physical
presence. Reviews therefore have auditable booking and host-attestation
provenance, not proof-of-personhood or guaranteed physical-stay truth.
