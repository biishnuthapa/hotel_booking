import React, { useState, useEffect } from 'react'
import { RainbowKitSiweNextAuthProvider } from '@rainbow-me/rainbowkit-siwe-next-auth'
import { WagmiConfig, configureChains, createConfig } from 'wagmi'
import { RainbowKitProvider, connectorsForWallets, darkTheme } from '@rainbow-me/rainbowkit'
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets'
import { mainnet, hardhat } from 'wagmi/chains'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { publicProvider } from 'wagmi/providers/public'
import { SessionProvider } from 'next-auth/react'

const polygonMumbai = {
  id: 80001,
  name: 'Polygon Mumbai',
  network: 'polygonMumbai',
  iconUrl: 'https://altcoinsbox.com/wp-content/uploads/2023/03/matic-logo.webp',
  iconBackground: '#282c34',
  nativeCurrency: {
    decimals: 18,
    name: 'Matic Token',
    symbol: 'MATIC',
  },
  rpcUrls: {
    public: { http: ['https://rpc-mumbai.maticvigil.com/'] },
    default: { http: ['https://rpc-mumbai.maticvigil.com/'] },
  },
  blockExplorers: {
    default: { name: 'Polygonscan', url: 'https://mumbai.polygonscan.com/' },
  },
  testnet: true,
}
const komodoTestnet = {
  id: 14963, // Replace with actual Komodo Testnet chain ID
  name: 'Komodo Testnet',
  network: 'komodoTestnet',
  iconUrl: 'https://komodoplatform.com/wp-content/uploads/2021/04/Komodo-Logo-Color.png', // Replace with Komodo logo
  iconBackground: '#000',
  nativeCurrency: {
    decimals: 18,
    name: 'Komodo',
    symbol: 'KMD',
  },
  rpcUrls: {
    public: { http: ['https://testnet.komodod.com/'] }, // Replace with Komodo Testnet RPC URL
    default: { http: ['https://testnet.komodod.com/'] }, // Replace with Komodo Testnet RPC URL
  },
  blockExplorers: {
    default: { name: 'Komodo Explorer', url: 'https://explorer.testnet.komodod.com/' }, // Replace with Komodo Testnet block explorer URL
  },
  testnet: true,
}

const { chains, publicClient } = configureChains(
  [mainnet, hardhat, polygonMumbai, komodoTestnet],
  [alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_ID }), publicProvider()]
)

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [metaMaskWallet({ projectId, chains })],
  },
])

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
})

const demoAppInfo = {
  appName: 'Hospitality NFT',
}

const getSiweMessageOptions = () => ({
  statement: `
  Once you're signed in, you'll be able to access all of our Hospitality's features.
  Thank you for partnering with HospitalityNFT!`,
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
