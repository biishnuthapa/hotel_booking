const envAddress = (value) => (value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value : null)
const envBlock = (value) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

export const SUPPORTED_CHAINS = {
  31337: {
    id: 31337,
    name: 'Hardhat Localhost',
    nativeSymbol: 'ETH',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545',
    explorerUrl: null,
    bookingAddress: envAddress(process.env.NEXT_PUBLIC_LOCAL_BOOKING_ADDRESS),
    reviewRegistryAddress: envAddress(process.env.NEXT_PUBLIC_LOCAL_REVIEW_REGISTRY),
    lensAddress: envAddress(process.env.NEXT_PUBLIC_LOCAL_LENS_ADDRESS),
    paymentToken: envAddress(process.env.NEXT_PUBLIC_LOCAL_PAYMENT_TOKEN),
    deploymentBlock: envBlock(process.env.NEXT_PUBLIC_LOCAL_DEPLOYMENT_BLOCK),
  },
  80002: {
    id: 80002,
    name: 'Polygon Amoy',
    nativeSymbol: 'POL',
    rpcUrl: process.env.NEXT_PUBLIC_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
    explorerUrl: 'https://amoy.polygonscan.com',
    bookingAddress: envAddress(process.env.NEXT_PUBLIC_AMOY_BOOKING_ADDRESS),
    reviewRegistryAddress: envAddress(process.env.NEXT_PUBLIC_AMOY_REVIEW_REGISTRY),
    lensAddress: envAddress(process.env.NEXT_PUBLIC_AMOY_LENS_ADDRESS),
    paymentToken: envAddress(process.env.NEXT_PUBLIC_AMOY_PAYMENT_TOKEN),
    deploymentBlock: envBlock(process.env.NEXT_PUBLIC_AMOY_DEPLOYMENT_BLOCK),
  },
  137: {
    id: 137,
    name: 'Polygon',
    nativeSymbol: 'POL',
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    bookingAddress: envAddress(process.env.NEXT_PUBLIC_POLYGON_BOOKING_ADDRESS),
    reviewRegistryAddress: envAddress(process.env.NEXT_PUBLIC_POLYGON_REVIEW_REGISTRY),
    lensAddress: envAddress(process.env.NEXT_PUBLIC_POLYGON_LENS_ADDRESS),
    paymentToken: envAddress(process.env.NEXT_PUBLIC_POLYGON_PAYMENT_TOKEN),
    deploymentBlock: envBlock(process.env.NEXT_PUBLIC_POLYGON_DEPLOYMENT_BLOCK),
  },
}

export function getChainConfig(chainId) {
  const config = SUPPORTED_CHAINS[Number(chainId)]
  if (!config) throw new Error(`Unsupported chain ${chainId}`)
  return config
}
