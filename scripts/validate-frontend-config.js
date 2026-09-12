const fs = require('fs')
const path = require('path')
const { loadEnvConfig } = require('@next/env')
const { Contract, JsonRpcProvider, getAddress, isAddress, keccak256 } = require('ethers')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const CHAINS = {
  80002: { name: 'Polygon Amoy', prefix: 'NEXT_PUBLIC_AMOY', production: false },
  137: { name: 'Polygon', prefix: 'NEXT_PUBLIC_POLYGON', production: true },
}
const ADDRESS_FIELDS = {
  bookingAddress: 'BOOKING_ADDRESS',
  reviewRegistryAddress: 'REVIEW_REGISTRY',
  lensAddress: 'LENS_ADDRESS',
  paymentToken: 'PAYMENT_TOKEN',
}

function required(env, name) {
  const value = String(env[name] || '').trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function validURL(value, name, { https = false } = {}) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || (https && parsed.protocol !== 'https:')) {
    throw new Error(`${name} must use ${https ? 'HTTPS' : 'HTTP or HTTPS'}`)
  }
  return parsed.toString()
}

function validAddress(value, name) {
  if (!isAddress(value) || value.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`${name} must be a non-zero EVM address`)
  }
  return getAddress(value)
}

function validateEnvironment(env, options = {}) {
  const chainId = Number(required(env, 'NEXT_PUBLIC_CHAIN_ID'))
  const chain = CHAINS[chainId]
  if (!chain) throw new Error('NEXT_PUBLIC_CHAIN_ID must be 80002 or 137 for a release build')
  const rpcName = `${chain.prefix}_RPC_URL`
  const rpcUrl = validURL(required(env, rpcName), rpcName, { https: true })
  const addresses = Object.fromEntries(
    Object.entries(ADDRESS_FIELDS).map(([field, suffix]) => {
      const name = `${chain.prefix}_${suffix}`
      return [field, validAddress(required(env, name), name)]
    })
  )
  if (new Set(Object.values(addresses).map((value) => value.toLowerCase())).size !== 4) {
    throw new Error('Booking, registry, lens, and payment-token addresses must be distinct')
  }
  const deploymentBlock = Number(required(env, `${chain.prefix}_DEPLOYMENT_BLOCK`))
  if (!Number.isSafeInteger(deploymentBlock) || deploymentBlock <= 0) {
    throw new Error(`${chain.prefix}_DEPLOYMENT_BLOCK must be a positive integer`)
  }

  if (!options.publicOnly) {
    const projectId = required(env, 'NEXT_PUBLIC_PROJECT_ID')
    if (projectId === 'walletconnect-project-id-required' || projectId.length < 16) {
      throw new Error('NEXT_PUBLIC_PROJECT_ID must be a real WalletConnect project ID')
    }
    validURL(required(env, 'NEXTAUTH_URL'), 'NEXTAUTH_URL', { https: true })
    if (required(env, 'NEXTAUTH_SECRET').length < 32) {
      throw new Error('NEXTAUTH_SECRET must contain at least 32 characters')
    }
    validURL(required(env, 'NEXT_PUBLIC_IPFS_GATEWAY'), 'NEXT_PUBLIC_IPFS_GATEWAY', {
      https: true,
    })
    required(env, 'PINATA_JWT')
    required(env, 'PINATA_GATEWAY')
    validURL(required(env, 'UPSTASH_REDIS_REST_URL'), 'UPSTASH_REDIS_REST_URL', { https: true })
    required(env, 'UPSTASH_REDIS_REST_TOKEN')
  }

  return { chainId, ...chain, rpcUrl, deploymentBlock, ...addresses }
}

async function verifyOnChain(config) {
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true })
  const [network, latestBlock] = await Promise.all([
    provider.getNetwork(),
    provider.getBlockNumber(),
  ])
  if (Number(network.chainId) !== config.chainId) {
    throw new Error(`RPC returned chain ${network.chainId}, expected ${config.chainId}`)
  }
  if (config.deploymentBlock > latestBlock) {
    throw new Error(
      `Deployment block ${config.deploymentBlock} is ahead of chain head ${latestBlock}`
    )
  }

  const entries = Object.entries(ADDRESS_FIELDS).map(([field]) => [field, config[field]])
  const codes = await Promise.all(entries.map(([, address]) => provider.getCode(address)))
  const empty = entries.filter((_entry, index) => codes[index] === '0x').map(([field]) => field)
  if (empty.length) throw new Error(`No bytecode found for: ${empty.join(', ')}`)

  const booking = new Contract(
    config.bookingAddress,
    ['function paymentToken() view returns (address)'],
    provider
  )
  const registry = new Contract(
    config.reviewRegistryAddress,
    ['function booking() view returns (address)'],
    provider
  )
  const lens = new Contract(
    config.lensAddress,
    ['function booking() view returns (address)', 'function reviews() view returns (address)'],
    provider
  )
  const [paymentToken, registryBooking, lensBooking, lensReviews] = await Promise.all([
    booking.paymentToken(),
    registry.booking(),
    lens.booking(),
    lens.reviews(),
  ])
  if (paymentToken.toLowerCase() !== config.paymentToken.toLowerCase()) {
    throw new Error('HospitalityBooking payment token does not match frontend configuration')
  }
  if (registryBooking.toLowerCase() !== config.bookingAddress.toLowerCase()) {
    throw new Error('ReviewRegistry points to a different HospitalityBooking contract')
  }
  if (
    lensBooking.toLowerCase() !== config.bookingAddress.toLowerCase() ||
    lensReviews.toLowerCase() !== config.reviewRegistryAddress.toLowerCase()
  ) {
    throw new Error('BookingLens dependencies do not match frontend configuration')
  }

  const deploymentPath = path.join(
    __dirname,
    '..',
    'contracts',
    'deployments',
    `${config.chainId}.json`
  )
  let deploymentRecord = 'not present; on-chain relationships were checked directly'
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))
    const expected = {
      bookingAddress: deployment.contracts?.HospitalityBooking,
      reviewRegistryAddress: deployment.contracts?.ReviewRegistry,
      lensAddress: deployment.contracts?.BookingLens,
      paymentToken: deployment.contracts?.paymentToken,
    }
    for (const [field, address] of Object.entries(expected)) {
      if (!address || address.toLowerCase() !== config[field].toLowerCase()) {
        throw new Error(`Deployment record does not match ${field}`)
      }
    }
    if (Number(deployment.deploymentBlock) !== config.deploymentBlock) {
      throw new Error('Deployment record does not match the configured deployment block')
    }
    for (let index = 0; index < entries.length; index += 1) {
      const [field] = entries[index]
      const recordName =
        ADDRESS_FIELDS[field] === 'PAYMENT_TOKEN'
          ? 'paymentToken'
          : {
              bookingAddress: 'HospitalityBooking',
              reviewRegistryAddress: 'ReviewRegistry',
              lensAddress: 'BookingLens',
            }[field]
      const expectedHash = deployment.runtime?.[recordName]?.keccak256
      if (expectedHash && keccak256(codes[index]) !== expectedHash) {
        throw new Error(
          `Runtime bytecode hash does not match the deployment record for ${recordName}`
        )
      }
    }
    deploymentRecord = 'matched addresses, block, and available runtime hashes'
  }

  return {
    latestBlock,
    deploymentRecord,
    codeSizes: Object.fromEntries(
      entries.map(([field], index) => [field, (codes[index].length - 2) / 2])
    ),
  }
}

async function main() {
  loadEnvConfig(path.join(__dirname, '..'))
  const config = validateEnvironment(process.env)
  const result = await verifyOnChain(config)
  console.log(`Validated ${config.name} frontend configuration.`)
  console.log(`Deployment block: ${config.deploymentBlock}; chain head: ${result.latestBlock}.`)
  console.log(`Deployment record: ${result.deploymentRecord}.`)
  console.log(
    `Bytecode present: ${Object.entries(result.codeSizes)
      .map(([name, bytes]) => `${name}=${bytes} bytes`)
      .join(', ')}.`
  )
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Frontend configuration invalid: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { validateEnvironment, verifyOnChain }
