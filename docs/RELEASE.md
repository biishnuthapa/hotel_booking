# V3 release runbook

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

1. Set a new `DEPLOYER_PRIVATE_KEY` and the four multisig/treasury addresses.
2. Run `npm run verify` on Node 22.
3. Run `npm run deploy:v3:amoy` and commit `contracts/deployments/80002.json`.
4. Verify V3, its immutable renderer, and mock token source on PolygonScan.
5. Publish explorer links, constructor roles, artifact hash, and deployment block.
6. Run the multi-wallet soak for at least 14 days while monitoring RPC failures,
   upload abuse, withdrawals, disputes, pauses, and the liability invariant.

## Mainnet gate

- Freeze a commit and reproduce its artifact hash in clean CI.
- Commission an independent audit on that exact commit and compiler configuration.
- Resolve all critical/high findings and document every accepted medium finding.
- Re-run all CI, Foundry, Slither, and soak scenarios.
- Review multisig thresholds, owners, recovery process, and treasury address out of band.
- Set `AUDITED_V3_ARTIFACT_HASH` and `MAINNET_RELEASE_APPROVED=true` only in the
  controlled deployment environment, then run `npm run deploy:v3:polygon`.

The deploy script rejects mainnet if the approval flag is absent or the compiled
artifact does not match the audited hash.
