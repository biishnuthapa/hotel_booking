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
const isLocalRpc = /127\.0\.0\.1|localhost/.test(localRpcUrl)
const localChainId = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 31337)
const localChainName = localChainId === 31337 ? 'Hardhat Localhost' : 'Localhost'

const hardhatLocalChain = {
  id: localChainId,
  name: localChainName,
  network: 'hardhat-localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: [localRpcUrl] },
    default: { http: [localRpcUrl] },
  },
  testnet: true,
}

const activeChains = isLocalRpc ? [hardhatLocalChain] : [polygonMainnet]

const { chains, publicClient } = configureChains(
  activeChains,
  isLocalRpc
    ? [
        jsonRpcProvider({
          rpc: () => ({ http: localRpcUrl }),
        }),
      ]
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
