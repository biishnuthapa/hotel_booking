import React, { useState, useEffect } from 'react'
import { RainbowKitSiweNextAuthProvider } from '@rainbow-me/rainbowkit-siwe-next-auth'
import { WagmiConfig, configureChains, createConfig } from 'wagmi'
import { RainbowKitProvider, connectorsForWallets, darkTheme } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, rainbowWallet } from '@rainbow-me/rainbowkit/wallets'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { publicProvider } from 'wagmi/providers/public'
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

const { chains, publicClient } = configureChains(
  [polygonMainnet],
  [alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_ID }), publicProvider()]
)

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

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
  appName: 'DappBnb dApp',
}

const getSiweMessageOptions = () => ({
  statement: `
  Once you're signed in, you'll be able to access all of our dApp's features.
  Thank you for partnering with DappBnb!`,
})

const Providers = ({ children, pageProps }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <WagmiConfig config={wagmiConfig}>
      <SessionProvider refetchInterval={0} session={pageProps.session}>
        <RainbowKitSiweNextAuthProvider getSiweMessageOptions={getSiweMessageOptions}>
          <RainbowKitProvider theme={darkTheme()} chains={chains} appInfo={demoAppInfo}>
            {mounted && children}
          </RainbowKitProvider>
        </RainbowKitSiweNextAuthProvider>
      </SessionProvider>
    </WagmiConfig>
  )
}

export default Providers
