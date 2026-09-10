import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import QRCode from 'qrcode'
import {
  BOOKING_STATUS,
  getV3HostBookings,
  getV3ListingWithRooms,
  getV3Listings,
  getV3PendingWithdrawal,
  getV3TokenInfo,
  sendV3Action,
  signCheckInAuthorization,
} from '@/services/blockchain'
import { epochDayToDateString } from '@/utils/dates'

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 80002)

const errorMessage = (error) => error?.shortMessage || error?.message || 'Operation failed'
const serializeAuthorization = (value) =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2)

function encodeAuthorization(value) {
  if (typeof window === 'undefined') return ''
  return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default function PropertyManagement() {
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [properties, setProperties] = useState([])
  const [bookings, setBookings] = useState([])
  const [token, setToken] = useState(null)
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0n)
  const [authorizations, setAuthorizations] = useState({})
  const [roomDrafts, setRoomDrafts] = useState({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!address) {
      setProperties([])
      setBookings([])
      return
    }
    setLoading(true)
    try {
      const [allListings, hostBookings, tokenInfo, withdrawal] = await Promise.all([
        getV3Listings(CHAIN_ID, { includeInactive: true }),
        getV3HostBookings(CHAIN_ID, address),
        getV3TokenInfo(CHAIN_ID),
        getV3PendingWithdrawal(CHAIN_ID, address),
      ])
      const owned = allListings.filter(
        (listing) => listing.owner.toLowerCase() === address.toLowerCase()
      )
      const hydrated = await Promise.all(
        owned.map(async (listing) => {
          const { rooms } = await getV3ListingWithRooms(CHAIN_ID, listing.id)
          return { listing, rooms }
        })
      )
      setProperties(hydrated)
      setBookings([...hostBookings].reverse())
      setToken(tokenInfo)
      setPendingWithdrawal(withdrawal)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    const timeout = setTimeout(refresh, 0)
    return () => clearTimeout(timeout)
  }, [refresh])

  const run = async (method, args, success) => {
    try {
      if (Number(activeChainId) !== CHAIN_ID) throw new Error(`Switch to chain ${CHAIN_ID}`)
      await sendV3Action(walletClient, CHAIN_ID, method, args)
      toast.success(success)
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const signAuthorization = async (bookingId) => {
    try {
      const authorization = await signCheckInAuthorization(walletClient, CHAIN_ID, bookingId)
      const serialized = serializeAuthorization(authorization)
      const deepLink = `${window.location.origin}/check-in?authorization=${encodeAuthorization(serialized)}`
      const qrDataURL = await QRCode.toDataURL(deepLink, { errorCorrectionLevel: 'M', margin: 1 })
      setAuthorizations((current) => ({
        ...current,
        [bookingId]: { serialized, deepLink, qrDataURL },
      }))
      toast.success('Authorization signed. Send it only to the booking guest.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const updateRoomDraft = (listingId, field, value) => {
    setRoomDrafts((current) => ({
      ...current,
      [listingId]: {
        name: '',
        metadataURI: '',
        price: '',
        capacity: 1,
        ...(current[listingId] || {}),
        [field]: value,
      },
    }))
  }

  const addRoom = async (listingId) => {
    try {
      const draft = roomDrafts[listingId]
      if (!draft?.name || !draft?.metadataURI || !draft?.price) throw new Error('Complete all room fields')
      const price = ethers.parseUnits(draft.price, token.decimals)
      await sendV3Action(walletClient, CHAIN_ID, 'addRoomType', [
        listingId,
        draft.name,
        draft.metadataURI,
        price,
        Number(draft.capacity),
      ])
      setRoomDrafts((current) => ({ ...current, [listingId]: null }))
      toast.success('Room type added.')
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#00773d]">V3 host</p>
          <h1 className="text-3xl font-semibold text-slate-900">Property management</h1>
          <p className="mt-1 text-sm text-slate-600">Deactivation preserves historical and active bookings.</p>
        </div>
        <Link href="/manage/new" className="rounded-xl bg-[#00773d] px-4 py-2 font-semibold text-white">
          Create V3 listing
        </Link>
      </div>

      {address && token && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border bg-white p-5">
          <div>
            <p className="text-xs uppercase text-slate-500">Host withdrawal</p>
            <p className="text-2xl font-semibold">{ethers.formatUnits(pendingWithdrawal, token.decimals)} {token.symbol}</p>
          </div>
          <button
            type="button"
            disabled={pendingWithdrawal === 0n}
            onClick={() => run('withdraw', [], 'Withdrawal finalized.')}
            className="rounded-xl bg-[#00773d] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
      )}

      {!address && <p className="rounded-xl border border-dashed p-8 text-center">Connect the host wallet.</p>}
      {loading && <p className="text-sm text-slate-500">Loading V3 host records…</p>}

      <section className="grid gap-6">
        {properties.map(({ listing, rooms }) => {
          const draft = roomDrafts[listing.id] || { name: '', metadataURI: '', price: '', capacity: 1 }
          return (
            <article key={listing.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{listing.name}</h2>
                  <p className="text-sm text-slate-500">Listing #{listing.id.toString()} · {rooms.length} room type(s)</p>
                </div>
                <button
                  type="button"
                  onClick={() => run('setListingActive', [listing.id, !listing.active], listing.active ? 'Listing deactivated.' : 'Listing activated.')}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold"
                >
                  {listing.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {rooms.map((room) => (
                  <div key={room.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <strong>{room.name}</strong> · {ethers.formatUnits(room.pricePerNight, token.decimals)} {token.symbol}
                    {!room.active && <span className="ml-2 text-slate-500">Inactive</span>}
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-2 rounded-xl border border-dashed p-4 sm:grid-cols-4">
                <input value={draft.name} onChange={(event) => updateRoomDraft(listing.id, 'name', event.target.value)} placeholder="Room name" className="rounded-lg border p-2 text-sm" />
                <input value={draft.metadataURI} onChange={(event) => updateRoomDraft(listing.id, 'metadataURI', event.target.value)} placeholder="ipfs:// metadata" className="rounded-lg border p-2 text-sm" />
                <input value={draft.price} onChange={(event) => updateRoomDraft(listing.id, 'price', event.target.value)} placeholder={`Price ${token.symbol}`} className="rounded-lg border p-2 text-sm" />
                <div className="flex gap-2">
                  <input type="number" min="1" value={draft.capacity} onChange={(event) => updateRoomDraft(listing.id, 'capacity', event.target.value)} className="w-20 rounded-lg border p-2 text-sm" />
                  <button type="button" onClick={() => addRoom(listing.id)} className="rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">Add</button>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Bookings requiring host attention</h2>
        <div className="mt-4 grid gap-4">
          {bookings.map((booking) => {
            const status = BOOKING_STATUS[Number(booking.status)]
            const authorization = authorizations[booking.id]
            return (
              <article key={booking.id} className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="font-semibold">Booking #{booking.id.toString()} · {status}</p>
                    <p className="text-sm text-slate-600">
                      Guest {booking.guest.slice(0, 8)}… · {epochDayToDateString(booking.checkInDay)} → {epochDayToDateString(booking.checkOutDay)}
                    </p>
                  </div>
                  {status === 'Booked' && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => signAuthorization(booking.id)} className="rounded-xl bg-[#00773d] px-3 py-2 text-sm font-semibold text-white">Sign check-in</button>
                      <button type="button" onClick={() => run('revokeCheckInAuthorization', [booking.id], 'Authorizations revoked.')} className="rounded-xl border px-3 py-2 text-sm font-semibold">Revoke nonce</button>
                      <button type="button" onClick={() => run('settleNoShow', [booking.id], 'No-show settled.')} className="rounded-xl border px-3 py-2 text-sm font-semibold">Settle no-show</button>
                    </div>
                  )}
                </div>
                {authorization && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Guest-bound authorization</p>
                    <textarea readOnly value={authorization.serialized} className="mt-2 h-36 w-full rounded-lg border p-2 font-mono text-[10px]" />
                    <img src={authorization.qrDataURL} alt="Guest check-in QR code" className="mt-3 h-44 w-44 rounded-lg border bg-white p-2" />
                    <a href={authorization.deepLink} className="mt-2 block break-all text-xs font-semibold text-[#00773d] underline">Open guest check-in deep link</a>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
