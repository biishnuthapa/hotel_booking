# Multi-chain statistical benchmark campaign (runbook)

Goal: upgrade the paper's Table 1 from "Hardhat EVM" to live-network data with
statistics (n ≥ 10 per operation, gas + confirmation-latency distributions) on
two independent chains.

## Funding needed (one wallet: `0x4Db46B9F88A8121fD24764f90b6F839471D5de27`)

| Chain | Needed | Current | Source |
|---|---|---|---|
| Polygon Amoy | ~2.5 POL (deploy 0.16 + ~0.23/iter × 10) | 0.06 POL | [faucet.polygon.technology](https://faucet.polygon.technology/), [Alchemy](https://www.alchemy.com/faucets/polygon-amoy) — claim across days or multiple faucets |
| BSC testnet | ~0.05 tBNB (gas floor is only 0.1 gwei) | 0 tBNB | [BNB Chain faucet](https://www.bnbchain.org/en/testnet-faucet) |

## Commands

```bash
# Amoy, 10 iterations, with live settlement measurement (~15 min wall time):
BENCH_ITERATIONS=10 BENCH_LIVE_CHECKIN=1 \
  npx hardhat run scripts/benchmark.js --network amoy

# BSC testnet, same:
BENCH_ITERATIONS=10 BENCH_LIVE_CHECKIN=1 \
  npx hardhat run scripts/benchmark.js --network bscTestnet
```

Outputs land in `benchmarks/benchmark-V1-<network>-<timestamp>.json` and
`benchmarks/benchmark-V1-latest.md`, including per-op gas min/mean/max and
confirmation latency. Repeat with `BENCH_CONTRACT=V2` if the V1↔V2 comparison
should also be replicated live.

## Notes
- `BENCH_LIVE_CHECKIN=1` books a real stay ~75 s out each iteration and waits,
  so settlement ops (check-in, checkout, review) get live measurements too.
  No-show `claimFunds` needs >24 h wait on a live chain and stays local-only.
- The script pauses 2 s between transactions to avoid public-RPC nonce lag.
- Booking value per iteration is negligible (`BENCH_PRICE` defaults to 0.0001
  on live networks) and most of it returns via the settlement paths.
- Read-scaling sweep (100 extra listings) runs local-only to conserve funds;
  gas usage is network-independent so this is methodologically fine.
- After the run, update paper Table 1 + §5.1 methodology wording, and add a
  latency column from `confirmLatencyMs`.
