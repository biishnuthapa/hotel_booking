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
const { ethers, network } = require('hardhat')

const TAX_BPS = Number(process.env.TAX_BPS || 700)
const DEPOSIT_BPS = Number(process.env.DEPOSIT_BPS || 500)
const DISPUTE_BOND_BPS = Number(process.env.DISPUTE_BOND_BPS || 200)
const ELIGIBILITY_BPS = Number(process.env.REVIEW_ELIGIBILITY_BPS || 5000)
const SATURATION_BPS = Number(process.env.REVIEW_SATURATION_BPS || 10000)
const REPEAT_WEIGHT_BPS = Number(process.env.REVIEW_REPEAT_WEIGHT_BPS || 2500)
const UNATTESTED_WEIGHT_BPS = Number(process.env.REVIEW_UNATTESTED_WEIGHT_BPS || 5000)

const MAINNETS = new Set(['polygon', 'mainnet'])

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
        throw new Error(`Refusing mainnet deploy: ${label} must be a multisig, not the deployer EOA.`)
      }
    }
    if (!process.env.PAYMENT_TOKEN) throw new Error('Refusing mainnet deploy: set PAYMENT_TOKEN.')
    if (process.env.AUDIT_COMPLETE !== 'true') {
      throw new Error('Refusing mainnet deploy: set AUDIT_COMPLETE=true only after an independent audit.')
    }
  }

  let paymentToken = process.env.PAYMENT_TOKEN
  if (!paymentToken) {
    const mock = await ethers.deployContract('MockUSDC')
    await mock.waitForDeployment()
    paymentToken = await mock.getAddress()
    await (await mock.mint(deployer.address, 10n ** 12n)).wait()
    console.log(`MockUSDC     ${paymentToken}  (test token — 1,000,000 minted to deployer)`)
  }

  const booking = await ethers.deployContract('HospitalityBooking', [
    paymentToken, treasury, TAX_BPS, DEPOSIT_BPS, DISPUTE_BOND_BPS, admin, pauser, arbitrator,
  ])
  await booking.waitForDeployment()
  const bookingAddress = await booking.getAddress()
  console.log(`Booking      ${bookingAddress}`)

  const registry = await ethers.deployContract('ReviewRegistry', [
    bookingAddress, ELIGIBILITY_BPS, SATURATION_BPS, REPEAT_WEIGHT_BPS, UNATTESTED_WEIGHT_BPS,
  ])
  await registry.waitForDeployment()
  const registryAddress = await registry.getAddress()
  console.log(`Registry     ${registryAddress}`)

  const lens = await ethers.deployContract('BookingLens', [bookingAddress, registryAddress])
  await lens.waitForDeployment()
  const lensAddress = await lens.getAddress()
  console.log(`Lens         ${lensAddress}`)

  const metadataAddress = await booking.metadataRenderer()
  console.log(`Metadata     ${metadataAddress}`)

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      HospitalityBooking: bookingAddress,
      ReviewRegistry: registryAddress,
      BookingLens: lensAddress,
      HospitalityBookingMetadata: metadataAddress,
      paymentToken,
    },
    roles: { treasury, admin, pauser, arbitrator },
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

  const dir = path.join(__dirname, '..', 'contracts', 'deployments')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${deployment.chainId}.json`), JSON.stringify(deployment, null, 2))
  fs.writeFileSync(
    path.join(__dirname, '..', 'contracts', 'contractAddress.json'),
    JSON.stringify(deployment.contracts, null, 2)
  )
  console.log(`\nSaved contracts/deployments/${deployment.chainId}.json`)

  if (!['hardhat', 'localhost'].includes(network.name)) {
    console.log(`\nVerify with:\n  npx hardhat verify --network ${network.name} ${bookingAddress} ${paymentToken} ${treasury} ${TAX_BPS} ${DEPOSIT_BPS} ${DISPUTE_BOND_BPS} ${admin} ${pauser} ${arbitrator}`)
    console.log(`  npx hardhat verify --network ${network.name} ${registryAddress} ${bookingAddress} ${ELIGIBILITY_BPS} ${SATURATION_BPS} ${REPEAT_WEIGHT_BPS} ${UNATTESTED_WEIGHT_BPS}`)
    console.log(`  npx hardhat verify --network ${network.name} ${lensAddress} ${bookingAddress} ${registryAddress}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
