# Economic sensitivity analysis — on-chain cost vs. OTA commission

Gas inputs: measured means (Hardhat EVM, n=5). Guest flow = book + check-in.
Fee scenarios as stated; commission benchmarks 15% and 25% of booking value.

## Ethereum L1 (20 gwei, native=$3000)

| Nights | On-chain cost | Booking value @$100/night | Cost as % of value | OTA 15% | OTA 25% |
|---|---|---|---|---|---|
| 1 | $32.63 | $100 | 32.63% | $15 | $25 |
| 3 | $38.17 | $300 | 12.72% | $45 | $75 |
| 7 | $49.53 | $700 | 7.08% | $105 | $175 |

**Break-even nightly rate** (rate at which on-chain cost = commission):

| Nights | vs 15% | vs 25% |
|---|---|---|
| 1 | $217.56/night | $130.53/night |
| 3 | $84.82/night | $50.89/night |
| 7 | $47.17/night | $28.30/night |

## Polygon PoS (30 gwei, native=$0.4)

| Nights | On-chain cost | Booking value @$100/night | Cost as % of value | OTA 15% | OTA 25% |
|---|---|---|---|---|---|
| 1 | $0.0065 | $100 | 6.53e-3% | $15 | $25 |
| 3 | $0.0076 | $300 | 2.54e-3% | $45 | $75 |
| 7 | $0.0099 | $700 | 1.42e-3% | $105 | $175 |

**Break-even nightly rate** (rate at which on-chain cost = commission):

| Nights | vs 15% | vs 25% |
|---|---|---|
| 1 | $0.04/night | $0.03/night |
| 3 | $0.02/night | $0.01/night |
| 7 | $9.43e-3/night | $5.66e-3/night |

## Arbitrum One (0.1 gwei, native=$3000)

| Nights | On-chain cost | Booking value @$100/night | Cost as % of value | OTA 15% | OTA 25% |
|---|---|---|---|---|---|
| 1 | $0.16 | $100 | 0.16% | $15 | $25 |
| 3 | $0.19 | $300 | 0.06% | $45 | $75 |
| 7 | $0.25 | $700 | 0.04% | $105 | $175 |

**Break-even nightly rate** (rate at which on-chain cost = commission):

| Nights | vs 15% | vs 25% |
|---|---|---|
| 1 | $1.09/night | $0.65/night |
| 3 | $0.42/night | $0.25/night |
| 7 | $0.24/night | $0.14/night |

## Reading

- On Polygon PoS the full guest flow costs well under a cent regardless of stay
  length; the break-even nightly rate vs. a 15% commission is a fraction of a
  cent — i.e., on-chain settlement is cheaper than OTA commission for any
  realistic price.
- On Arbitrum-class L2 fees the conclusion is unchanged (break-even under $1.20/night).
- On Ethereum L1 the flow costs $33-$50; it beats a 15% commission only above
  ~$218/night for 1-night stays (~$47/night for 7-night stays) — quantifying
  why an L1 deployment is economically inappropriate for low-value bookings
  and why the system targets an L2/side-chain.
- Caveats: token prices and gas prices are volatile; figures use the stated
  assumptions. Excludes host listing costs (amortized across bookings) and any
  fiat on/off-ramp costs, which apply to both models asymmetrically.
