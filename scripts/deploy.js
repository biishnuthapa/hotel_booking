/**
 * Deploys the HospitalityBooking system.
 *
 *   HospitalityBooking       core escrow + lifecycle + proof-of-stay NFT
 *     └─ HospitalityBookingMetadata   deployed automatically by the constructor
 *   ReviewRegistry           review-integrity mechanism (R1/R2/R3)
 *   BookingLens              stateless bounded reads
 *
 * Local / testnet:  a MockUSDC is deployed and minted to the deployer unless
 * PAYMENT_TOKEN is set. Mainnet:  PAYMENT_TOKEN is required and never mocked.
 *
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network amoy
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { artifacts, ethers, network } = require('hardhat')

const TAX_BPS = Number(process.env.TAX_BPS || 700)
const DEPOSIT_BPS = Number(process.env.DEPOSIT_BPS || 500)
const DISPUTE_BOND_BPS = Number(process.env.DISPUTE_BOND_BPS || 200)
const ELIGIBILITY_BPS = Number(process.env.REVIEW_ELIGIBILITY_BPS || 5000)
const SATURATION_BPS = Number(process.env.REVIEW_SATURATION_BPS || 10000)
const REPEAT_WEIGHT_BPS = Number(process.env.REVIEW_REPEAT_WEIGHT_BPS || 2500)
const UNATTESTED_WEIGHT_BPS = Number(process.env.REVIEW_UNATTESTED_WEIGHT_BPS || 5000)

const MAINNETS = new Set(['polygon', 'mainnet'])
const AUDITED_CONTRACTS = [
  'HospitalityBooking',
  'ReviewRegistry',
  'BookingLens',
  'HospitalityBookingMetadata',
]

async function assertAuditedBuild() {
  const manifestPath = process.env.AUDITED_MANIFEST_PATH
  if (!manifestPath) {
    throw new Error(
      'Refusing mainnet deploy: set AUDITED_MANIFEST_PATH to the reviewed audit manifest.'
    )
  }
  const absolutePath = path.resolve(manifestPath)
  if (!fs.existsSync(absolutePath)) throw new Error(`Audit manifest not found: ${absolutePath}`)
  const manifest = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    encoding: 'utf8',
  }).trim()
  if (dirty) throw new Error('Refusing mainnet deploy: tracked working tree is not clean.')
  if (manifest.commit !== head) {
    throw new Error(
      `Refusing mainnet deploy: audited commit ${manifest.commit} does not match ${head}.`
    )
  }
  if (manifest.compiler !== '0.8.30') {
    throw new Error(
      `Refusing mainnet deploy: audited compiler is ${manifest.compiler}, expected 0.8.30.`
    )
  }
  for (const name of AUDITED_CONTRACTS) {
    const artifact = await artifacts.readArtifact(name)
    const actual = ethers.keccak256(artifact.bytecode)
    if (manifest.creationBytecode?.[name] !== actual) {
      throw new Error(`Refusing mainnet deploy: ${name} does not match the audited bytecode.`)
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners()
  if (!deployer) throw new Error('No signer. Set DEPLOYER_PRIVATE_KEY in .env')

  const isMainnet = MAINNETS.has(network.name)
  const balance = await ethers.provider.getBalance(deployer.address)
  console.log(`network      ${network.name}`)
  console.log(`deployer     ${deployer.address}`)
  console.log(`balance      ${ethers.formatEther(balance)}`)
  if (balance === 0n) throw new Error('Deployer has no native balance for gas.')

  const treasury = process.env.PLATFORM_TREASURY || deployer.address
  const admin = process.env.ADMIN_ADDRESS || deployer.address
  const pauser = process.env.PAUSER_ADDRESS || admin
  const arbitrator = process.env.ARBITRATOR_ADDRESS || admin

  if (isMainnet) {
    for (const [label, value] of Object.entries({ treasury, admin, pauser, arbitrator })) {
      if (value === deployer.address) {
        throw new Error(
          `Refusing mainnet deploy: ${label} must be a multisig, not the deployer EOA.`
        )
      }
    }
    if (!process.env.PAYMENT_TOKEN) throw new Error('Refusing mainnet deploy: set PAYMENT_TOKEN.')
    if (process.env.AUDIT_COMPLETE !== 'true') {
      throw new Error(
        'Refusing mainnet deploy: set AUDIT_COMPLETE=true only after an independent audit.'
      )
    }
    await assertAuditedBuild()
  }

  let paymentToken = process.env.PAYMENT_TOKEN
  let mockPaymentToken = false
  let tokenReceipt = null
  if (!paymentToken) {
    const mock = await ethers.deployContract('MockUSDC')
    await mock.waitForDeployment()
    tokenReceipt = await mock.deploymentTransaction().wait()
    mockPaymentToken = true
    paymentToken = await mock.getAddress()
    await (await mock.mint(deployer.address, 10n ** 12n)).wait()
    console.log(`MockUSDC     ${paymentToken}  (test token — 1,000,000 minted to deployer)`)
  }

  const booking = await ethers.deployContract('HospitalityBooking', [
    paymentToken,
    treasury,
    TAX_BPS,
    DEPOSIT_BPS,
    DISPUTE_BOND_BPS,
    admin,
    pauser,
    arbitrator,
  ])
  await booking.waitForDeployment()
  const bookingReceipt = await booking.deploymentTransaction().wait()
  const bookingAddress = await booking.getAddress()
  console.log(`Booking      ${bookingAddress}`)

  const registry = await ethers.deployContract('ReviewRegistry', [
    bookingAddress,
    ELIGIBILITY_BPS,
    SATURATION_BPS,
    REPEAT_WEIGHT_BPS,
    UNATTESTED_WEIGHT_BPS,
  ])
  await registry.waitForDeployment()
  const registryReceipt = await registry.deploymentTransaction().wait()
  const registryAddress = await registry.getAddress()
  console.log(`Registry     ${registryAddress}`)

  const lens = await ethers.deployContract('BookingLens', [bookingAddress, registryAddress])
  await lens.waitForDeployment()
  const lensReceipt = await lens.deploymentTransaction().wait()
  const lensAddress = await lens.getAddress()
  console.log(`Lens         ${lensAddress}`)

  const metadataAddress = await booking.metadataRenderer()
  console.log(`Metadata     ${metadataAddress}`)

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deploymentBlock: bookingReceipt.blockNumber,
    deployer: deployer.address,
    mockPaymentToken,
    contracts: {
      HospitalityBooking: bookingAddress,
      ReviewRegistry: registryAddress,
      BookingLens: lensAddress,
      HospitalityBookingMetadata: metadataAddress,
      paymentToken,
    },
    roles: { treasury, admin, pauser, arbitrator },
    transactions: {
      paymentToken: tokenReceipt?.hash || null,
      HospitalityBooking: bookingReceipt.hash,
      ReviewRegistry: registryReceipt.hash,
      BookingLens: lensReceipt.hash,
      HospitalityBookingMetadata: bookingReceipt.hash,
    },
    constructorArguments: {
      HospitalityBooking: [
        paymentToken,
        treasury,
        TAX_BPS,
        DEPOSIT_BPS,
        DISPUTE_BOND_BPS,
        admin,
        pauser,
        arbitrator,
      ],
      ReviewRegistry: [
        bookingAddress,
        ELIGIBILITY_BPS,
        SATURATION_BPS,
        REPEAT_WEIGHT_BPS,
        UNATTESTED_WEIGHT_BPS,
      ],
      BookingLens: [bookingAddress, registryAddress],
      HospitalityBookingMetadata: [],
      MockUSDC: [],
    },
    parameters: {
      taxBps: TAX_BPS,
      securityDepositBps: DEPOSIT_BPS,
      disputeBondBps: DISPUTE_BOND_BPS,
      reviewEligibilityBps: ELIGIBILITY_BPS,
      reviewSaturationBps: SATURATION_BPS,
      reviewRepeatWeightBps: REPEAT_WEIGHT_BPS,
      reviewUnattestedWeightBps: UNATTESTED_WEIGHT_BPS,
    },
  }

  deployment.runtime = {}
  for (const [name, address] of Object.entries(deployment.contracts)) {
    const code = await ethers.provider.getCode(address)
    deployment.runtime[name] = {
      bytes: (code.length - 2) / 2,
      keccak256: code === '0x' ? null : ethers.keccak256(code),
    }
  }

  const dir = path.join(__dirname, '..', 'contracts', 'deployments')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${deployment.chainId}.json`),
    JSON.stringify(deployment, null, 2)
  )
  console.log(`\nSaved contracts/deployments/${deployment.chainId}.json`)

  const frontendPrefixes = {
    31337: 'NEXT_PUBLIC_LOCAL',
    80002: 'NEXT_PUBLIC_AMOY',
    137: 'NEXT_PUBLIC_POLYGON',
  }
  const frontendPrefix = frontendPrefixes[deployment.chainId]
  if (frontendPrefix) {
    console.log('\nFrontend public configuration:')
    console.log(`NEXT_PUBLIC_CHAIN_ID=${deployment.chainId}`)
    console.log(`${frontendPrefix}_BOOKING_ADDRESS=${bookingAddress}`)
    console.log(`${frontendPrefix}_REVIEW_REGISTRY=${registryAddress}`)
    console.log(`${frontendPrefix}_LENS_ADDRESS=${lensAddress}`)
    console.log(`${frontendPrefix}_PAYMENT_TOKEN=${paymentToken}`)
    console.log(`${frontendPrefix}_DEPLOYMENT_BLOCK=${deployment.deploymentBlock}`)
  }

  if (!['hardhat', 'localhost'].includes(network.name)) {
    console.log(`\nVerify all deployed contracts with:`)
    console.log(`  hardhat run scripts/verify-deployment.js --network ${network.name}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
