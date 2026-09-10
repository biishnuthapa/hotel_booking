import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import {
  getLegacyGuestBookings,
  getLegacyListings,
  getLegacyOwnedTokens,
} from '@/services/blockchainLegacy'
import { getChainConfig } from '@/config/chains'
import { normalizeIpfsUrl } from '@/utils/helper'

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 80002)

export default function LegacyPage({ listings, explorerUrl, contractAddress, loadError }) {
  const { address } = useAccount()
  const [walletRecords, setWalletRecords] = useState({ bookings: [], tokens: [], error: null })

  useEffect(() => {
    let active = true
    if (!address) {
      return () => { active = false }
    }
    Promise.all([getLegacyGuestBookings(address), getLegacyOwnedTokens(address)])
      .then(([bookings, tokens]) => {
        if (active) setWalletRecords({ bookings, tokens, error: null })
      })
      .catch((error) => {
        if (active) setWalletRecords({ bookings: [], tokens: [], error: error?.message || 'Unable to read wallet records.' })
      })
    return () => { active = false }
  }, [address])

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Head><title>Legacy V1 · Read only</title></Head>
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
        <p className="text-xs font-bold uppercase tracking-widest">Legacy V1 · read only</p>
        <h1 className="mt-2 text-3xl font-semibold">Historical records remain visible.</h1>
        <p className="mt-2 max-w-3xl text-sm">
          V1 has known design limitations and is not used for new writes. Listings, bookings, and NFTs
          are not imported into V3.
        </p>
        {explorerUrl && contractAddress && (
          <a
            href={`${explorerUrl}/address/${contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block font-semibold underline"
          >
            View the unchanged V1 contract on the explorer
          </a>
        )}
      </div>

      {loadError && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{loadError}</p>}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <article key={listing.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img
              src={normalizeIpfsUrl(listing.images?.[0] || listing.imageURI || '')}
              alt=""
              className="h-48 w-full bg-slate-100 object-cover"
            />
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900">{listing.name}</h2>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-900">
                  V1
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{listing.location}</p>
              <p className="mt-3 text-xs text-slate-500">Property #{listing.id} · writes disabled</p>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-10 border-t border-slate-200 pt-8">
        <h2 className="text-2xl font-semibold">Connected-wallet V1 records</h2>
        <p className="mt-1 text-sm text-slate-600">These bookings and NFTs are displayed without transaction controls.</p>
        {!address && <p className="mt-4 rounded-xl border border-dashed p-6">Connect a wallet to read its legacy records.</p>}
        {walletRecords.error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{walletRecords.error}</p>}
        {address && (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5">
              <h3 className="font-semibold">Bookings ({walletRecords.bookings.length})</h3>
              <div className="mt-3 grid gap-2">
                {walletRecords.bookings.map((booking) => (
                  <div key={`${booking.aid}-${booking.id}`} className="rounded-xl bg-slate-50 p-3 text-xs">
                    Property #{booking.aid} · Booking #{booking.id} · read only
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5">
              <h3 className="font-semibold">NFTs ({walletRecords.tokens.length})</h3>
              <div className="mt-3 grid gap-2">
                {walletRecords.tokens.map((token) => (
                  <div key={token.id} className="rounded-xl bg-slate-50 p-3 text-xs">
                    Legacy token #{token.id} · read only
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export async function getServerSideProps() {
  let chain
  try {
    chain = getChainConfig(CHAIN_ID)
  } catch {
    chain = { explorerUrl: null, legacyV1Address: null }
  }
  try {
    const listings = await getLegacyListings()
    return {
      props: {
        listings: JSON.parse(JSON.stringify(listings)),
        explorerUrl: chain.explorerUrl,
        contractAddress: chain.legacyV1Address,
        loadError: null,
      },
    }
  } catch (error) {
    return {
      props: {
        listings: [],
        explorerUrl: chain.explorerUrl,
        contractAddress: chain.legacyV1Address,
        loadError: error?.shortMessage || error?.message || 'Unable to load the legacy deployment.',
      },
    }
  }
}
