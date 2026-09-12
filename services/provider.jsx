import React, { useState } from 'react'
import { RainbowKitSiweNextAuthProvider } from '@rainbow-me/rainbowkit-siwe-next-auth'
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { polygon, polygonAmoy } from 'wagmi/chains'
import { defineChain, http } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { ACTIVE_CHAIN_ID, getChainConfig } from '@/config/chains'

const chainConfig = getChainConfig(ACTIVE_CHAIN_ID)
const hardhat = defineChain({
  id: 31337,
  name: 'Hardhat Localhost',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
  testnet: true,
})
const chainById = { 31337: hardhat, 80002: polygonAmoy, 137: polygon }
const baseChain = chainById[ACTIVE_CHAIN_ID] || polygonAmoy
const activeChain = {
  ...baseChain,
  rpcUrls: { ...baseChain.rpcUrls, default: { http: [chainConfig.rpcUrl] } },
}

export const wagmiConfig = getDefaultConfig({
  appName: 'HospitalityBooking',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID || 'walletconnect-project-id-required',
  chains: [activeChain],
  transports: { [activeChain.id]: http(chainConfig.rpcUrl, { timeout: 12_000 }) },
  ssr: true,
})

const enableSiwe =
  process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SIWE === 'true'
const siweOptions = () => ({
  statement: 'Sign in to manage HospitalityBooking records and authenticated IPFS uploads.',
})

export default function Providers({ children, pageProps }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      })
  )
  const rainbow = (
    <RainbowKitProvider
      theme={darkTheme({ accentColor: '#0f766e', accentColorForeground: '#ffffff' })}
    >
      {children}
    </RainbowKitProvider>
  )
  return (
    <WagmiProvider config={wagmiConfig}>
      <SessionProvider refetchInterval={0} session={pageProps.session}>
        <QueryClientProvider client={queryClient}>
          {enableSiwe ? (
            <RainbowKitSiweNextAuthProvider getSiweMessageOptions={siweOptions}>
              {rainbow}
            </RainbowKitSiweNextAuthProvider>
          ) : (
            rainbow
          )}
        </QueryClientProvider>
      </SessionProvider>
    </WagmiProvider>
  )
}
