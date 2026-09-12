import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { AddressLink, DeploymentNotice, EmptyState } from '@/components/AppUI'
import {
  ACTIVE_CHAIN_ID,
  getChainConfig,
  getMissingDeploymentConfiguration,
  isDeploymentConfigured,
} from '@/config/chains'
import { getListings, getPaymentTokenInfo } from '@/services/blockchain'
import { normalizeIpfsUrl } from '@/utils/helper'

export default function Home({ listings, token, chain, deploymentReady, missing, loadError }) {
  return (
    <>
      <Head>
        <title>HospitalityBooking · Verifiable stays</title>
        <meta
          name="description"
          content="Book hospitality with stable-token escrow, canonical dates, and guest-controlled check-in with optional host attestation."
        />
      </Head>

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl shadow-slate-900/10">
          <div className="absolute inset-y-0 right-0 hidden w-[48%] lg:block">
            <Image
              src="/assets/image2.jpg"
              alt="Beach resort at sunrise"
              fill
              priority
              sizes="48vw"
              className="object-cover opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/55 to-transparent" />
          </div>
          <div className="relative z-10 max-w-3xl px-6 py-12 sm:px-10 sm:py-16 lg:py-20">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
              <span className="rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1.5">
                HospitalityBooking
              </span>
              <span>{chain.name}</span>
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              A clearer way to book and settle a stay.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Stable-token escrow, UTC date ranges, guest-controlled arrival, optional host
              attestation, and transparent pull payments—built into one immutable protocol.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#properties"
                className="inline-flex items-center rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300"
              >
                Explore properties
              </Link>
              <Link
                href="/MyBookings"
                className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                View my trips
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <p className="text-2xl font-semibold">90</p>
                <p className="mt-1 text-xs text-slate-300">night maximum</p>
              </div>
              <div className="metric-card">
                <p className="text-2xl font-semibold">UTC</p>
                <p className="mt-1 text-xs text-slate-300">canonical dates</p>
              </div>
              <div className="metric-card">
                <p className="text-2xl font-semibold">1:1</p>
                <p className="mt-1 text-xs text-slate-300">booking pass</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              'Exact-value escrow',
              'The contract rejects fee-on-transfer discrepancies and accounts for every atomic token unit.',
            ],
            [
              'Check-in without suppression',
              'Guests can check in directly; a replay-safe host signature adds stronger review provenance.',
            ],
            [
              'Recoverable disputes',
              'Opening requires a bond, and unresolved cases time out in the non-opener’s favor.',
            ],
          ].map(([title, description], index) => (
            <article key={title} className="app-card p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-sm font-bold text-teal-800">
                0{index + 1}
              </span>
              <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="properties" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-12 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Live inventory</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Active properties
            </h2>
            {token && (
              <p className="mt-2 text-sm text-slate-600">
                Prices settle in {token.symbol}. Payment token{' '}
                <AddressLink chainId={chain.id} address={token.address} />
              </p>
            )}
          </div>
          {deploymentReady && (
            <p className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
              {listings.length} active {listings.length === 1 ? 'listing' : 'listings'}
            </p>
          )}
        </div>

        {!deploymentReady && (
          <DeploymentNotice chainId={chain.id} missing={missing} message={loadError} />
        )}

        {deploymentReady && listings.length === 0 && (
          <EmptyState
            title="No active properties yet"
            description="The deployment is ready. A connected host can create the first property."
            actionHref="/manage/new"
            actionLabel="Create a property"
          />
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10"
            >
              <Link href={`/stay/${listing.id}`} className="block">
                <div className="relative h-56 overflow-hidden bg-slate-100">
                  <img
                    src={normalizeIpfsUrl(listing.imageURI)}
                    alt={`${listing.name} property`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-teal-800 shadow-sm backdrop-blur">
                    Verified listing
                  </span>
                </div>
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{listing.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">Listing #{listing.id}</p>
                    </div>
                    <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {listing.totalRooms} rooms
                    </span>
                  </div>
                </div>
              </Link>
              <p className="px-5 pb-5 text-xs text-slate-500">
                Hosted by <AddressLink chainId={chain.id} address={listing.owner} />
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm leading-6 text-amber-950">
          <strong>What check-in proves:</strong> a valid host authorization was submitted by the
          booked guest in the permitted window. It does not independently prove physical presence or
          room quality.
        </div>
      </section>
    </>
  )
}

export async function getServerSideProps() {
  const chain = getChainConfig(ACTIVE_CHAIN_ID)
  const chainProps = { id: chain.id, name: chain.name, testnet: chain.testnet }
  const missing = getMissingDeploymentConfiguration(ACTIVE_CHAIN_ID)
  if (!isDeploymentConfigured(ACTIVE_CHAIN_ID)) {
    return {
      props: {
        listings: [],
        token: null,
        chain: chainProps,
        deploymentReady: false,
        missing,
        loadError: `${chain.name} is awaiting the finalized deployment addresses.`,
      },
    }
  }

  try {
    const [rawListings, token] = await Promise.all([
      getListings(ACTIVE_CHAIN_ID),
      getPaymentTokenInfo(ACTIVE_CHAIN_ID),
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
        chain: chainProps,
        deploymentReady: true,
        missing: [],
        loadError: null,
      },
    }
  } catch (error) {
    return {
      props: {
        listings: [],
        token: null,
        chain: chainProps,
        deploymentReady: false,
        missing: [],
        loadError: error?.shortMessage || error?.message || 'Unable to verify the deployment.',
      },
    }
  }
}
