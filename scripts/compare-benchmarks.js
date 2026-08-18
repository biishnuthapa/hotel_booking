/**
 * Builds a V1-vs-V2 gas comparison table from the most recent benchmark JSON
 * of each variant in artifacts/benchmarks/.
 *
 * Usage: node scripts/compare-benchmarks.js
 * Output: artifacts/benchmarks/comparison.md
 */
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'benchmarks')

function latest(variant) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`benchmark-${variant}-`) && f.endsWith('.json'))
    .sort()
  if (!files.length) throw new Error(`No benchmark JSON found for ${variant}; run scripts/benchmark.js first`)
  return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'))
}

const v1 = latest('V1')
const v2 = latest('V2')

let md = `# Gas comparison — V1 (on-chain metadata) vs V2 (off-chain metadata + paginated reads)\n\n`
md += `V1 run: ${v1.generatedAt} · V2 run: ${v2.generatedAt} · network: ${v1.network} · iterations: ${v1.iterations}\n\n`
md += `| Operation | V1 gas (mean) | V2 gas (mean) | Δ | Reduction |\n|---|---|---|---|---|\n`

const labels = Object.keys(v1.gas).filter((l) => v2.gas[l])
for (const label of labels) {
  const a = v1.gas[label].mean
  const b = v2.gas[label].mean
  const delta = b - a
  const pct = ((delta / a) * 100).toFixed(1)
  md += `| ${label} | ${a.toLocaleString()} | ${b.toLocaleString()} | ${delta > 0 ? '+' : ''}${delta.toLocaleString()} | ${delta < 0 ? `**${(-pct)}%**` : `${-pct}%`} |\n`
}

if (v1.readScaling?.length && v2.readScaling?.length) {
  md += `\n## Listing read cost vs marketplace size\n\n`
  md += `V1 \`getApartments()\` reads all listings in one unbounded call; V2 \`getApartmentsPaged(0, 25)\` reads one bounded page.\n\n`
  md += `| Apartments | V1 estimateGas | V2 estimateGas (page of 25) |\n|---|---|---|\n`
  for (let i = 0; i < v1.readScaling.length; i++) {
    md += `| ${v1.readScaling[i].apartments} | ${Number(v1.readScaling[i].getApartmentsEstimateGas).toLocaleString()} | ${Number(v2.readScaling[i].getApartmentsEstimateGas).toLocaleString()} |\n`
  }
}

const out = path.join(dir, 'comparison.md')
fs.writeFileSync(out, md)
console.log(md)
console.log(`\nWritten to ${out}`)
