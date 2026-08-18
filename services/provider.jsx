import React, { useState, useEffect } from 'react'
import { RainbowKitSiweNextAuthProvider } from '@rainbow-me/rainbowkit-siwe-next-auth'
import { WagmiConfig, configureChains, createConfig } from 'wagmi'
import { RainbowKitProvider, connectorsForWallets, darkTheme } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, rainbowWallet } from '@rainbow-me/rainbowkit/wallets'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { publicProvider } from 'wagmi/providers/public'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import { SessionProvider } from 'next-auth/react'

const polygonMainnet = {
  id: 137,
  name: 'Polygon',
  network: 'polygon',
  iconUrl: 'https://cdn-icons-png.flaticon.com/128/14446/14446221.png',
  iconBackground: '#000000',
  nativeCurrency: {
    decimals: 18,
    name: 'Matic',
    symbol: 'MATIC',
  },
  rpcUrls: {
    public: { http: ['https://rpc-mainnet.maticvigil.com/'] },
    default: { http: ['https://rpc-mainnet.maticvigil.com/'] },
  },
  blockExplorers: {
    default: { name: 'Polygon Explorer', url: 'https://polygonscan.com/' },
    etherscan: { name: 'Polygon Explorer', url: 'https://polygonscan.com/' },
  },
  testnet: false,
}

const localRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'
const localChainId = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 31337)

// Per-network metadata so the wallet (RainbowKit/wagmi) targets the SAME chain
// the app reads/writes on. Keyed by NEXT_PUBLIC_LOCAL_CHAIN_ID.
const CHAINS_BY_ID = {
  31337: {
    id: 31337,
    name: 'Hardhat Localhost',
    network: 'hardhat-localhost',
    nativeCurrency: { decimals: 18, name: 'Ethereum', symbol: 'ETH' },
    rpcUrls: { public: { http: [localRpcUrl] }, default: { http: [localRpcUrl] } },
    testnet: true,
  },
  80002: {
    id: 80002,
    name: 'Polygon Amoy',
    network: 'polygon-amoy',
    nativeCurrency: { decimals: 18, name: 'POL', symbol: 'POL' },
    rpcUrls: { public: { http: [localRpcUrl] }, default: { http: [localRpcUrl] } },
    blockExplorers: {
      default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' },
    },
    testnet: true,
  },
  137: polygonMainnet,
}

const activeChain = CHAINS_BY_ID[localChainId] || {
  id: localChainId,
  name: `Chain ${localChainId}`,
  network: `chain-${localChainId}`,
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { public: { http: [localRpcUrl] }, default: { http: [localRpcUrl] } },
  testnet: true,
}

// Custom / testnet chains (local, Amoy) use their configured RPC directly;
// Polygon mainnet keeps the Alchemy + public providers.
const usesCustomRpc = localChainId !== 137

const { chains, publicClient } = configureChains(
  [activeChain],
  usesCustomRpc
    ? [jsonRpcProvider({ rpc: () => ({ http: localRpcUrl }) })]
    : [alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_ID }), publicProvider()]
)

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
const enableSiwe = process.env.NEXT_PUBLIC_ENABLE_SIWE === 'true'

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [metaMaskWallet({ projectId, chains }), rainbowWallet({ projectId, chains })],
  },
])

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
})

const demoAppInfo = {
  appName: 'HospitalityBooking dApp',
}

const getSiweMessageOptions = () => ({
  statement: `
  Once you're signed in, you'll be able to access all of our dApp's features.
  Thank you for partnering with HospitalityBooking!`,
})

const Providers = ({ children, pageProps }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const content = (
    <RainbowKitProvider theme={darkTheme()} chains={chains} appInfo={demoAppInfo}>
      {mounted && children}
    </RainbowKitProvider>
  )

  return (
    <WagmiConfig config={wagmiConfig}>
      <SessionProvider refetchInterval={0} session={pageProps.session}>
        {enableSiwe ? (
          <RainbowKitSiweNextAuthProvider getSiweMessageOptions={getSiweMessageOptions}>
            {content}
          </RainbowKitSiweNextAuthProvider>
        ) : (
          content
        )}
      </SessionProvider>
    </WagmiConfig>
  )
}

export default Providers
