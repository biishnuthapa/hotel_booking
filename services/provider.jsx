import React, { useState } from 'react'
import { RainbowKitSiweNextAuthProvider } from '@rainbow-me/rainbowkit-siwe-next-auth'
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { polygon, polygonAmoy } from 'wagmi/chains'
import { defineChain, http } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'

const configuredChainId = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 80002)
const configuredRpc = process.env.NEXT_PUBLIC_RPC_URL
const hardhat = defineChain({
  id: 31337,
  name: 'Hardhat Localhost',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: [configuredRpc || 'http://127.0.0.1:8545'] } },
  testnet: true,
})
const chainById = { 31337: hardhat, 80002: polygonAmoy, 137: polygon }
const activeChain = chainById[configuredChainId] || polygonAmoy
const activeRpc =
  configuredRpc ||
  (configuredChainId === 137
    ? process.env.NEXT_PUBLIC_POLYGON_RPC_URL
    : process.env.NEXT_PUBLIC_AMOY_RPC_URL) ||
  activeChain.rpcUrls.default.http[0]

export const wagmiConfig = getDefaultConfig({
  appName: 'HospitalityBooking',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID || 'development-project-id',
  chains: [activeChain],
  transports: { [activeChain.id]: http(activeRpc) },
  ssr: true,
})

const enableSiwe =
  process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SIWE === 'true'
const siweOptions = () => ({
  statement: 'Sign in to manage HospitalityBooking V3 records and authenticated IPFS uploads.',
})

export default function Providers({ children, pageProps }) {
  const [queryClient] = useState(() => new QueryClient())
  const rainbow = <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
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
