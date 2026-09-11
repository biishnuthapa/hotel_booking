/**
 * Freeze the exact commit, compiler, configuration, and creation bytecode sent
 * to an independent auditor. Creating this file does not mean an audit passed.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { artifacts, ethers } = require('hardhat')

const CONTRACTS = [
  'HospitalityBooking',
  'ReviewRegistry',
  'BookingLens',
  'HospitalityBookingMetadata',
]

async function main() {
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    encoding: 'utf8',
  }).trim()
  if (dirty) throw new Error('Commit all tracked changes before freezing an audit manifest.')

  const manifest = {
    schemaVersion: 1,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    compiler: '0.8.30',
    evmVersion: 'shanghai',
    optimizer: { enabled: true, runs: 1 },
    viaIR: true,
    createdAt: new Date().toISOString(),
    creationBytecode: {},
  }
  for (const name of CONTRACTS) {
    const artifact = await artifacts.readArtifact(name)
    manifest.creationBytecode[name] = ethers.keccak256(artifact.bytecode)
  }

  const output = path.resolve(process.env.AUDIT_MANIFEST_OUTPUT || 'audit-manifest.candidate.json')
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  console.log(`Wrote audit candidate manifest to ${output}`)
  console.log('Have the auditor review and return this exact manifest before setting AUDIT_COMPLETE=true.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
