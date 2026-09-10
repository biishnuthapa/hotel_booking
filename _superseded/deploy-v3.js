const { ethers, network, artifacts, run } = require('hardhat')
const fs = require('fs')
const path = require('path')

const AMOY_CHAIN_ID = 80002n
const POLYGON_CHAIN_ID = 137n
const TAX_BPS = 700
const SECURITY_DEPOSIT_BPS = 500
const DISPUTE_BOND_BPS = 200

function requiredAddress(name) {
  const value = process.env[name]
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be a non-zero address`)
  }
  return value
}

async function verify(address, constructorArguments) {
  if (network.name === 'hardhat' || network.name === 'localhost') return
  try {
    await run('verify:verify', { address, constructorArguments })
  } catch (error) {
    const message = String(error?.message || error)
    if (!message.toLowerCase().includes('already verified')) throw error
  }
}

async function main() {
  const [deployer] = await ethers.getSigners()
  if (!deployer) throw new Error('No deployer. Set DEPLOYER_PRIVATE_KEY for public networks.')
  const { chainId } = await ethers.provider.getNetwork()

  if (chainId === POLYGON_CHAIN_ID) {
    if (process.env.MAINNET_RELEASE_APPROVED !== 'true') {
      throw new Error('Polygon deployment is blocked until MAINNET_RELEASE_APPROVED=true')
    }
    const artifact = await artifacts.readArtifact('HospitalityBookingV3')
    const artifactHash = ethers.keccak256(artifact.bytecode)
    if (!process.env.AUDITED_V3_ARTIFACT_HASH || process.env.AUDITED_V3_ARTIFACT_HASH !== artifactHash) {
      throw new Error(`Audited artifact mismatch. Current V3 artifact hash: ${artifactHash}`)
    }
  }

  let paymentTokenAddress = process.env.V3_PAYMENT_TOKEN
  let mockToken
  if (!paymentTokenAddress && (chainId === AMOY_CHAIN_ID || chainId === 31337n)) {
    mockToken = await ethers.deployContract('MockUSDC')
    await mockToken.waitForDeployment()
    paymentTokenAddress = await mockToken.getAddress()
  }
  if (!paymentTokenAddress || !ethers.isAddress(paymentTokenAddress)) {
    throw new Error('V3_PAYMENT_TOKEN is required for this chain')
  }

  const isLocal = chainId === 31337n
  const role = (name) => (isLocal ? deployer.address : requiredAddress(name))
  const treasury = role('V3_TREASURY')
  const admin = role('V3_ADMIN_MULTISIG')
  const pauser = role('V3_PAUSER_MULTISIG')
  const arbitrator = role('V3_ARBITRATOR_MULTISIG')
  const args = [
    paymentTokenAddress,
    treasury,
    TAX_BPS,
    SECURITY_DEPOSIT_BPS,
    DISPUTE_BOND_BPS,
    admin,
    pauser,
    arbitrator,
  ]

  const contract = await ethers.deployContract('HospitalityBookingV3', args)
  const receipt = await contract.deploymentTransaction().wait()
  const address = await contract.getAddress()
  const renderer = await contract.metadataRenderer()
  const runtimeCode = await ethers.provider.getCode(address)
  const artifact = await artifacts.readArtifact('HospitalityBookingV3')
  const deployment = {
    chainId: Number(chainId),
    network: network.name,
    hospitalityBookingV3: address,
    metadataRenderer: renderer,
    paymentToken: paymentTokenAddress,
    mockPaymentToken: mockToken ? paymentTokenAddress : null,
    treasury,
    admin,
    pauser,
    arbitrator,
    taxBps: TAX_BPS,
    securityDepositBps: SECURITY_DEPOSIT_BPS,
    disputeBondBps: DISPUTE_BOND_BPS,
    deploymentBlock: receipt.blockNumber,
    deploymentTransaction: receipt.hash,
    artifactHash: ethers.keccak256(artifact.bytecode),
    runtimeCodeHash: ethers.keccak256(runtimeCode),
  }

  const outputDirectory = path.join(__dirname, '..', 'contracts', 'deployments')
  fs.mkdirSync(outputDirectory, { recursive: true })
  const outputPath = path.join(outputDirectory, `${chainId}.json`)
  fs.writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`)

  await verify(address, args)
  await verify(renderer, [])
  if (mockToken) await verify(paymentTokenAddress, [])
  console.log(JSON.stringify(deployment, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
