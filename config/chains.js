const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const envAddress = (value) =>
  value && ADDRESS_PATTERN.test(value) && value.toLowerCase() !== ZERO_ADDRESS ? value : null

const envBlock = (value) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

const configuredChainId = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID || process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 80002
)

export const ACTIVE_CHAIN_ID = configuredChainId

export const SUPPORTED_CHAINS = {
  31337: {
    id: 31337,
    name: 'Hardhat Localhost',
    shortName: 'Local',
    nativeSymbol: 'ETH',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545',
    explorerUrl: null,
    bookingAddress: envAddress(process.env.NEXT_PUBLIC_LOCAL_BOOKING_ADDRESS),
    reviewRegistryAddress: envAddress(process.env.NEXT_PUBLIC_LOCAL_REVIEW_REGISTRY),
    lensAddress: envAddress(process.env.NEXT_PUBLIC_LOCAL_LENS_ADDRESS),
    paymentToken: envAddress(process.env.NEXT_PUBLIC_LOCAL_PAYMENT_TOKEN),
    legacyV1Address: envAddress(process.env.NEXT_PUBLIC_LOCAL_LEGACY_V1_ADDRESS),
    deploymentBlock: envBlock(process.env.NEXT_PUBLIC_LOCAL_DEPLOYMENT_BLOCK),
    testnet: true,
  },
  80002: {
    id: 80002,
    name: 'Polygon Amoy',
    shortName: 'Amoy',
    nativeSymbol: 'POL',
    rpcUrl: process.env.NEXT_PUBLIC_AMOY_RPC_URL || 'https://polygon-amoy.drpc.org',
    explorerUrl: 'https://amoy.polygonscan.com',
    // V3 addresses are intentionally environment-only. A stale fallback must
    // never direct production writes to a superseded deployment.
    bookingAddress: envAddress(process.env.NEXT_PUBLIC_AMOY_BOOKING_ADDRESS),
    reviewRegistryAddress: envAddress(process.env.NEXT_PUBLIC_AMOY_REVIEW_REGISTRY),
    lensAddress: envAddress(process.env.NEXT_PUBLIC_AMOY_LENS_ADDRESS),
    paymentToken: envAddress(process.env.NEXT_PUBLIC_AMOY_PAYMENT_TOKEN),
    legacyV1Address:
      envAddress(process.env.NEXT_PUBLIC_AMOY_LEGACY_V1_ADDRESS) ||
      '0x630dbDfa393bAd0c364E1AE559Cee5A6ED17768E',
    deploymentBlock: envBlock(process.env.NEXT_PUBLIC_AMOY_DEPLOYMENT_BLOCK),
    testnet: true,
  },
  137: {
    id: 137,
    name: 'Polygon',
    shortName: 'Polygon',
    nativeSymbol: 'POL',
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon.drpc.org',
    explorerUrl: 'https://polygonscan.com',
    bookingAddress: envAddress(process.env.NEXT_PUBLIC_POLYGON_BOOKING_ADDRESS),
    reviewRegistryAddress: envAddress(process.env.NEXT_PUBLIC_POLYGON_REVIEW_REGISTRY),
    lensAddress: envAddress(process.env.NEXT_PUBLIC_POLYGON_LENS_ADDRESS),
    paymentToken: envAddress(process.env.NEXT_PUBLIC_POLYGON_PAYMENT_TOKEN),
    legacyV1Address: envAddress(process.env.NEXT_PUBLIC_POLYGON_LEGACY_V1_ADDRESS),
    deploymentBlock: envBlock(process.env.NEXT_PUBLIC_POLYGON_DEPLOYMENT_BLOCK),
    testnet: false,
  },
}

const REQUIRED_V3_FIELDS = [
  ['bookingAddress', 'HospitalityBooking'],
  ['reviewRegistryAddress', 'ReviewRegistry'],
  ['lensAddress', 'BookingLens'],
  ['paymentToken', 'payment token'],
  ['deploymentBlock', 'deployment block'],
]

export function getChainConfig(chainId = ACTIVE_CHAIN_ID) {
  const config = SUPPORTED_CHAINS[Number(chainId)]
  if (!config) throw new Error(`Unsupported chain ${chainId}`)
  return config
}

export function getMissingV3Configuration(chainId = ACTIVE_CHAIN_ID) {
  const chain = getChainConfig(chainId)
  return REQUIRED_V3_FIELDS.filter(([field]) => chain[field] === null).map(([, label]) => label)
}

export function isV3Configured(chainId = ACTIVE_CHAIN_ID) {
  return getMissingV3Configuration(chainId).length === 0
}

export function assertV3Configured(chainId = ACTIVE_CHAIN_ID) {
  const chain = getChainConfig(chainId)
  const missing = getMissingV3Configuration(chainId)
  if (missing.length) {
    throw new Error(`${chain.name} V3 configuration is incomplete: ${missing.join(', ')}`)
  }
  return chain
}

export function explorerAddressUrl(chainId, address) {
  const explorer = getChainConfig(chainId).explorerUrl
  return explorer && address ? `${explorer}/address/${address}` : null
}

export function explorerTransactionUrl(chainId, hash) {
  const explorer = getChainConfig(chainId).explorerUrl
  return explorer && hash ? `${explorer}/tx/${hash}` : null
}
