import Head from 'next/head'
import Link from 'next/link'
import { getV3Listings, getV3TokenInfo } from '@/services/blockchain'
import { normalizeIpfsUrl } from '@/utils/helper'

const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 80002)

export default function Home({ listings, token, deploymentReady, loadError }) {
  return (
    <>
      <Head>
        <title>HospitalityBooking V3</title>
        <meta
          name="description"
          content="Stable-token hotel booking with host-authorized check-in."
        />
      </Head>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-800">
            HospitalityBooking V3
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            Canonical dates, stable-token escrow, and host-authorized check-in.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Checkout is exclusive, booking passes cannot be transferred, and settlement balances are
            withdrawn by their recipients.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="#listings" className="rounded-xl bg-[#00773d] px-5 py-3 font-semibold text-white">
              Browse V3 listings
            </Link>
          </div>
        </div>
      </section>

      <section id="listings" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Active V3 properties</h2>
            {token && (
              <p className="text-sm text-slate-500">
                Prices use {token.symbol} ({token.decimals} decimals).
              </p>
            )}
          </div>
          <p className="text-sm text-slate-500">{listings.length} listing(s)</p>
        </div>

        {!deploymentReady && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
            <p className="font-semibold">V3 is not configured for this environment.</p>
            <p className="mt-1 text-sm">{loadError}</p>
          </div>
        )}

        {deploymentReady && listings.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
            No active V3 listings yet.
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/stay/${listing.id}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <img
                src={normalizeIpfsUrl(listing.imageURI)}
                alt=""
                className="h-52 w-full bg-slate-100 object-cover"
              />
              <div className="p-5">
                <h3 className="text-lg font-semibold text-slate-900">{listing.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {listing.totalRooms} rooms · Listing #{listing.id}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

export async function getServerSideProps() {
  try {
    const [rawListings, token] = await Promise.all([
      getV3Listings(DEFAULT_CHAIN_ID),
      getV3TokenInfo(DEFAULT_CHAIN_ID),
    ])
    const listings = rawListings.map((listing) => ({
      id: listing.id.toString(),
      owner: listing.owner,
      name: listing.name,
      metadataURI: listing.metadataURI,
      imageURI: listing.imageURI,
      totalRooms: Number(listing.totalRooms),
    }))
    return {
      props: {
        listings,
        token,
        deploymentReady: true,
        loadError: null,
      },
    }
  } catch (error) {
    return {
      props: {
        listings: [],
        token: null,
        deploymentReady: false,
        loadError: error?.shortMessage || error?.message || 'Unable to read the V3 deployment.',
      },
    }
  }
}
