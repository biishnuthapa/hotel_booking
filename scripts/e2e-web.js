const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const deploymentPath = path.join(__dirname, '..', 'contracts', 'deployments', '31337.json')
const binary = (name) =>
  path.join(
    __dirname,
    '..',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${name}.cmd` : name
  )
let deployed = false
for (let attempt = 0; attempt < 30 && !deployed; attempt += 1) {
  const result = spawnSync(
    binary('hardhat'),
    ['run', 'scripts/deploy.js', '--network', 'localhost'],
    {
      cwd: path.join(__dirname, '..'),
      stdio: attempt === 29 ? 'inherit' : 'ignore',
      env: { ...process.env, LOCALHOST_RPC_URL: 'http://127.0.0.1:9545' },
    }
  )
  deployed = result.status === 0
  if (!deployed) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000)
}
if (!deployed) throw new Error('Could not deploy the local E2E contracts')

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
const child = spawn(binary('next'), ['dev', '-p', '3100'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_CHAIN_ID: '31337',
    NEXT_PUBLIC_RPC_URL: 'http://127.0.0.1:9545',
    NEXT_PUBLIC_LOCAL_BOOKING_ADDRESS: deployment.contracts.HospitalityBooking,
    NEXT_PUBLIC_LOCAL_REVIEW_REGISTRY: deployment.contracts.ReviewRegistry,
    NEXT_PUBLIC_LOCAL_LENS_ADDRESS: deployment.contracts.BookingLens,
    NEXT_PUBLIC_LOCAL_PAYMENT_TOKEN: deployment.contracts.paymentToken,
    NEXT_PUBLIC_LOCAL_DEPLOYMENT_BLOCK: String(deployment.deploymentBlock),
    NEXT_PUBLIC_ENABLE_SIWE: 'false',
  },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code || 0))
