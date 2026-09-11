import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useChainId, useWalletClient } from 'wagmi'
import { toast } from 'react-toastify'
import { AddressLink, EmptyState, TransactionStatus } from '@/components/AppUI'
import { ACTIVE_CHAIN_ID, getChainConfig, isV3Configured } from '@/config/chains'
import { approveAndBook, getV3ListingWithRooms, getV3TokenInfo } from '@/services/blockchain'
import { addDaysToDateString, todayUTCDateString, validateStayDates } from '@/utils/dates'
import { normalizeIpfsUrl } from '@/utils/helper'
import { formatTokenAmount } from '@/utils/token'

export default function StayPage({ listing, rooms, token, chain, loadError }) {
  const router = useRouter()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const activeRooms = rooms.filter((room) => room.active)
  const [roomTypeId, setRoomTypeId] = useState(activeRooms[0]?.id || '')
  const [roomsRequested, setRoomsRequested] = useState(1)
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [transactionState, setTransactionState] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const selectedRoom = activeRooms.find((room) => room.id === roomTypeId)
  const minimumCheckIn = addDaysToDateString(todayUTCDateString(), 1)
  const minimumCheckout = checkInDate ? addDaysToDateString(checkInDate, 1) : minimumCheckIn
  const maximumCheckout = checkInDate ? addDaysToDateString(checkInDate, 90) : undefined

  const quote = (() => {
    if (!selectedRoom || !token || !checkInDate || !checkOutDate) return { error: null }
    try {
      const { nights } = validateStayDates(checkInDate, checkOutDate)
      const requested = Number(roomsRequested)
      if (!Number.isSafeInteger(requested) || requested < 1 || requested > selectedRoom.capacity) {
        throw new Error(`Choose between 1 and ${selectedRoom.capacity} rooms`)
      }
      const base = BigInt(selectedRoom.pricePerNight) * BigInt(requested) * BigInt(nights)
      const deposit = (base * BigInt(token.securityDepositBps)) / 10_000n
      return { nights, base, deposit, total: base + deposit, error: null }
    } catch (error) {
      return { error: error.message }
    }
  })()

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      if (!walletClient) throw new Error('Connect the guest wallet first')
      if (Number(activeChainId) !== ACTIVE_CHAIN_ID) {
        throw new Error(`Switch your wallet to ${chain.name}`)
      }
      if (quote.error || !quote.total) throw new Error(quote.error || 'Choose valid stay dates')
      await approveAndBook(
        walletClient,
        ACTIVE_CHAIN_ID,
        {
          listingId: listing.id,
          roomTypeId,
          rooms: Number(roomsRequested),
          checkInDate,
          checkOutDate,
        },
        setTransactionState
      )
      toast.success('Booking finalized. Your non-transferable stay pass is ready.')
      await router.replace(router.asPath)
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || 'Booking failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError || !listing || !token) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState title="This V3 listing is unavailable" description={loadError || 'The deployment is not configured.'} actionHref="/" actionLabel="Return to explore" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{listing.name} · HospitalityBooking V3</title>
        <meta name="description" content={`Book ${listing.name} using ${token.symbol} escrow.`} />
      </Head>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-semibold text-teal-700 hover:text-teal-900">← Back to properties</Link>
        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-[2rem] bg-slate-100">
              <img src={normalizeIpfsUrl(listing.imageURI)} alt={`${listing.name} property`} className="h-72 w-full object-cover sm:h-[28rem]" />
            </div>

            <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">V3 listing #{listing.id}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{listing.name}</h1>
                <p className="mt-2 text-sm text-slate-500">Hosted by <AddressLink chainId={chain.id} address={listing.owner} /></p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${listing.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                {listing.active ? 'Accepting bookings' : 'Deactivated'}
              </span>
            </div>

            <section className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-950">Room types</h2>
                <p className="text-sm text-slate-500">{activeRooms.length} available</p>
              </div>
              {rooms.length === 0 ? (
                <EmptyState title="No room types configured" description="The host has not added room inventory yet." />
              ) : (
                <div className="mt-4 grid gap-4">
                  {rooms.map((room) => (
                    <article key={room.id} className={`app-card flex flex-wrap items-center justify-between gap-4 p-5 ${!room.active ? 'opacity-60' : ''}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{room.name}</h3>
                          {!room.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">Inactive</span>}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Up to {room.capacity} rooms per night</p>
                      </div>
                      <p className="text-right font-semibold text-slate-950">
                        {formatTokenAmount(room.pricePerNight, token.decimals, token.symbol)}
                        <span className="block text-xs font-normal text-slate-500">per room / night</span>
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="h-fit lg:sticky lg:top-28">
            <form onSubmit={submit} className="app-card p-6">
              <p className="eyebrow">Secure reservation</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Book with {token.symbol}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Checkout is exclusive. Your exact price and schedule are snapshotted on-chain.</p>

              <label className="mt-5 block text-sm font-medium text-slate-700">
                Room type
                <select value={roomTypeId} onChange={(event) => setRoomTypeId(event.target.value)} className="field" required>
                  {activeRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Number of rooms
                <input type="number" min="1" max={selectedRoom?.capacity || 1} value={roomsRequested} onChange={(event) => setRoomsRequested(event.target.value)} className="field" required />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">
                  Check-in
                  <input type="date" min={minimumCheckIn} value={checkInDate} onChange={(event) => {
                    const next = event.target.value
                    setCheckInDate(next)
                    if (checkOutDate && checkOutDate <= next) setCheckOutDate(addDaysToDateString(next, 1))
                  }} className="field" required />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Checkout
                  <input type="date" min={minimumCheckout} max={maximumCheckout} value={checkOutDate} onChange={(event) => setCheckOutDate(event.target.value)} className="field" required />
                </label>
              </div>

              {quote.error && checkInDate && checkOutDate && <p className="mt-3 text-sm text-red-700">{quote.error}</p>}
              {quote.total !== undefined && (
                <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between gap-3 text-slate-600"><span>{quote.nights} nights × {roomsRequested} rooms</span><span>{formatTokenAmount(quote.base, token.decimals, token.symbol)}</span></div>
                  <div className="mt-2 flex justify-between gap-3 text-slate-600"><span>Security deposit</span><span>{formatTokenAmount(quote.deposit, token.decimals, token.symbol)}</span></div>
                  <div className="mt-3 flex justify-between gap-3 border-t border-slate-200 pt-3 font-semibold text-slate-950"><span>Total escrow</span><span>{formatTokenAmount(quote.total, token.decimals, token.symbol)}</span></div>
                </div>
              )}

              <TransactionStatus transaction={transactionState} chainId={chain.id} />
              <button type="submit" disabled={submitting || !listing.active || !walletClient || !roomTypeId || Boolean(quote.error) || !quote.total} className="button-primary mt-5 flex w-full">
                {submitting ? 'Confirming on-chain…' : walletClient ? 'Approve and book' : 'Connect wallet to book'}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-slate-500">ERC-20 approval is requested only when the current allowance is insufficient.</p>
            </form>
          </aside>
        </div>
      </div>
    </>
  )
}

export async function getServerSideProps({ params }) {
  const chain = getChainConfig(ACTIVE_CHAIN_ID)
  const chainProps = { id: chain.id, name: chain.name }
  if (!isV3Configured(ACTIVE_CHAIN_ID)) {
    return { props: { listing: null, rooms: [], token: null, chain: chainProps, loadError: `${chain.name} V3 is not configured.` } }
  }
  try {
    const [{ listing, rooms }, token] = await Promise.all([
      getV3ListingWithRooms(ACTIVE_CHAIN_ID, params.listingId),
      getV3TokenInfo(ACTIVE_CHAIN_ID),
    ])
    return {
      props: {
        listing: {
          id: listing.id.toString(), name: listing.name, imageURI: listing.imageURI,
          metadataURI: listing.metadataURI, owner: listing.owner, active: listing.active,
        },
        rooms: rooms.map((room) => ({
          id: room.id.toString(), name: room.name, metadataURI: room.metadataURI,
          pricePerNight: room.pricePerNight.toString(), capacity: Number(room.capacity), active: room.active,
        })),
        token,
        chain: chainProps,
        loadError: null,
      },
    }
  } catch (error) {
    return {
      props: {
        listing: null, rooms: [], token: null, chain: chainProps,
        loadError: error?.shortMessage || error?.message || 'Unable to load this listing.',
      },
    }
  }
}
