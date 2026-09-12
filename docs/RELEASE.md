# Release runbook

## Credential incident response

- Treat the historically committed private key as permanently compromised.
- Create a new hardware-backed deployment wallet; transfer remaining assets and revoke approvals.
- Revoke and reissue Pinata, NextAuth, WalletConnect, Redis, RPC, explorer, and API credentials.
- Never copy secret values into issues, logs, chat, deployment JSON, or frontend variables.
- Have all collaborators back up work, agree on a cutover window, then run a reviewed
  `git filter-repo` rewrite removing `.env`. Force-push once and require fresh clones.

These operations require account owners and collaborator coordination; they are
not performed by application code.

## Amoy

1. Set a new `DEPLOYER_PRIVATE_KEY`. Set the four multisig/treasury addresses
   before any production deployment.
2. Run `npm run verify` on Node 22.
3. Run `npm run deploy:amoy` (or deploy the same constructor sequence manually)
   and commit the generated `contracts/deployments/80002.json`.
4. Run `npm run verify:amoy`. Sourcify verification is keyless; PolygonScan
   verification additionally requires `POLYGONSCAN_API_KEY`.
5. Publish explorer links, constructor roles, artifact hash, and deployment block.
6. Copy the generated addresses and deployment block into the Amoy
   `NEXT_PUBLIC_*` variables and rebuild the frontend. Never reuse an outdated
   address from git history.
7. Set production SIWE, WalletConnect, Pinata, and Redis configuration, then run
   `npm run validate:frontend`. This checks RPC chain identity, bytecode at every
   address, token/registry/lens relationships, the deployment block, and any
   available deployment-record hashes without printing secrets.
8. Run `npm run soak:start:amoy` once, then `npm run soak:amoy` at least daily
   for 14 days while monitoring RPC failures,
   upload abuse, withdrawals, disputes, pauses, and the liability invariant.

## Mainnet gate

- Freeze a commit and reproduce its artifact hash in clean CI.
- Commission an independent audit on that exact commit and compiler configuration.
- Resolve all critical/high findings and document every accepted medium finding.
- Re-run all CI, Foundry, Slither, and soak scenarios.
- Review multisig thresholds, owners, recovery process, and treasury address out of band.
- On the clean audited commit, run `npm run audit:freeze` and have the auditor
  review the resulting candidate manifest.
- Set `AUDIT_COMPLETE=true` and `AUDITED_MANIFEST_PATH` only in the controlled
  deployment environment, then run `npm run deploy:polygon`.

The deploy script rejects mainnet if the audit flag or manifest is absent, the
working tree or commit differs, any protocol creation bytecode differs, the
payment token is missing, or a privileged address is the deployer EOA.
