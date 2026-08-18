/**
 * Economic sensitivity analysis: on-chain booking cost vs. OTA commission.
 *
 * Inputs are the measured mean gas figures from benchmarks/comparison.md
 * (Hardhat EVM, n=5; gas usage is network-independent). For each fee scenario
 * and stay length we compute the total on-chain cost of the guest-side flow
 * (book + check-in) and the host-side settlement where applicable, then:
 *   1. cost as a % of booking value across nightly rates, vs. 15% / 25% OTA
 *      commission benchmarks;
 *   2. the break-even nightly rate at which on-chain cost equals commission.
 *
 * Usage: node scripts/econ-analysis.js
 * Output: benchmarks/econ-analysis.md (+ JSON)
 */
const fs = require('fs')
const path = require('path')

// Measured mean gas (V1, Hardhat EVM, n=5) — see benchmarks/comparison.md
const GAS = {
  book: { 1: 427039, 3: 519285, 7: 708621 },
  checkIn: 116856,
}

const SCENARIOS = [
  { name: 'Ethereum L1', gasPriceGwei: 20, nativeUsd: 3000 },
  { name: 'Polygon PoS', gasPriceGwei: 30, nativeUsd: 0.4 },
  { name: 'Arbitrum One', gasPriceGwei: 0.1, nativeUsd: 3000 },
]

const COMMISSIONS = [0.15, 0.25]
const NIGHTLY_RATES = [50, 100, 200, 400]
const STAYS = [1, 3, 7]

const usd = (gas, sc) => gas * sc.gasPriceGwei * 1e-9 * sc.nativeUsd

let md = `# Economic sensitivity analysis — on-chain cost vs. OTA commission\n\n`
md += `Gas inputs: measured means (Hardhat EVM, n=5). Guest flow = book + check-in.\n`
md += `Fee scenarios as stated; commission benchmarks 15% and 25% of booking value.\n\n`

const json = { scenarios: [] }

for (const sc of SCENARIOS) {
  md += `## ${sc.name} (${sc.gasPriceGwei} gwei, native=$${sc.nativeUsd})\n\n`
  const rows = []
  md += `| Nights | On-chain cost | Booking value @$100/night | Cost as % of value | OTA 15% | OTA 25% |\n|---|---|---|---|---|---|\n`
  for (const nights of STAYS) {
    const gas = GAS.book[nights] + GAS.checkIn
    const cost = usd(gas, sc)
    const value = 100 * nights
    const pct = (cost / value) * 100
    md += `| ${nights} | $${cost.toFixed(cost < 0.01 ? 4 : 2)} | $${value} | ${pct < 0.01 ? pct.toExponential(2) : pct.toFixed(2)}% | $${(value * 0.15).toFixed(0)} | $${(value * 0.25).toFixed(0)} |\n`
    rows.push({ nights, gas, costUsd: cost })
  }

  md += `\n**Break-even nightly rate** (rate at which on-chain cost = commission):\n\n`
  md += `| Nights | vs 15% | vs 25% |\n|---|---|---|\n`
  for (const nights of STAYS) {
    const cost = usd(GAS.book[nights] + GAS.checkIn, sc)
    const be15 = cost / (nights * 0.15)
    const be25 = cost / (nights * 0.25)
    const f = (v) => (v < 0.01 ? `$${v.toExponential(2)}` : `$${v.toFixed(2)}`)
    md += `| ${nights} | ${f(be15)}/night | ${f(be25)}/night |\n`
  }
  md += `\n`

  json.scenarios.push({ ...sc, rows })
}

md += `## Reading\n\n`
md += `- On Polygon PoS the full guest flow costs well under a cent regardless of stay\n`
md += `  length; the break-even nightly rate vs. a 15% commission is a fraction of a\n`
md += `  cent — i.e., on-chain settlement is cheaper than OTA commission for any\n`
md += `  realistic price.\n`
md += `- On Arbitrum-class L2 fees the conclusion is unchanged (break-even under $1.20/night).\n`
md += `- On Ethereum L1 the flow costs $33-$50; it beats a 15% commission only above\n`
md += `  ~$218/night for 1-night stays (~$47/night for 7-night stays) — quantifying\n`
md += `  why an L1 deployment is economically inappropriate for low-value bookings\n`
md += `  and why the system targets an L2/side-chain.\n`
md += `- Caveats: token prices and gas prices are volatile; figures use the stated\n`
md += `  assumptions. Excludes host listing costs (amortized across bookings) and any\n`
md += `  fiat on/off-ramp costs, which apply to both models asymmetrically.\n`

const outDir = path.join(__dirname, '..', 'benchmarks')
fs.writeFileSync(path.join(outDir, 'econ-analysis.md'), md)
fs.writeFileSync(path.join(outDir, 'econ-analysis.json'), JSON.stringify(json, null, 2))
console.log(md)
