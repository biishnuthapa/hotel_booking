import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { toast } from 'react-toastify'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import {
  AddressLink,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  TransactionStatus,
  WalletPrompt,
} from '@/components/AppUI'
import { ACTIVE_CHAIN_ID, getChainConfig, isV3Configured } from '@/config/chains'
import {
  BOOKING_STATUS,
  approveAndOpenDispute,
  getV3DisputeInfo,
  getV3HostBookings,
  getV3ListingWithRooms,
  getV3Listings,
  getV3PendingWithdrawal,
  getV3TokenInfo,
  hashEvidenceReference,
  sendV3Action,
  signCheckInAuthorization,
} from '@/services/blockchain'
import { formatEpochDay } from '@/utils/dates'
import { formatTokenAmount, parseTokenAmount } from '@/utils/token'

const POST_CHECKOUT_DISPUTE_WINDOW = 86_400
const errorMessage = (error) => error?.shortMessage || error?.message || 'Operation failed'
const serializeAuthorization = (value) =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2)

function encodeAuthorization(value) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function formatTimestamp(seconds) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(Number(seconds) * 1000)
  )
}

export default function PropertyManagement() {
  const chain = getChainConfig(ACTIVE_CHAIN_ID)
  const configured = isV3Configured(ACTIVE_CHAIN_ID)
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [properties, setProperties] = useState([])
  const [bookings, setBookings] = useState([])
  const [token, setToken] = useState(null)
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0n)
  const [authorizations, setAuthorizations] = useState({})
  const [roomDrafts, setRoomDrafts] = useState({})
  const [roomEdits, setRoomEdits] = useState({})
  const [listingEdits, setListingEdits] = useState({})
  const [evidence, setEvidence] = useState({})
  const [disputes, setDisputes] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [busyAction, setBusyAction] = useState(null)
  const [transactionState, setTransactionState] = useState(null)
  const [currentTimestamp, setCurrentTimestamp] = useState(0)

  useEffect(() => {
    const tick = () => setCurrentTimestamp(Math.floor(Date.now() / 1000))
    const initialTick = setTimeout(tick, 0)
    const interval = setInterval(tick, 30_000)
    return () => {
      clearTimeout(initialTick)
      clearInterval(interval)
    }
  }, [])

  const ensureWriteReady = () => {
    if (!walletClient) throw new Error('Connect the host wallet first')
    if (Number(activeChainId) !== ACTIVE_CHAIN_ID) throw new Error(`Switch your wallet to ${chain.name}`)
  }

  const refresh = useCallback(async () => {
    if (!address || !configured) {
      setProperties([])
      setBookings([])
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const [allListings, hostBookings, tokenInfo, withdrawal] = await Promise.all([
        getV3Listings(ACTIVE_CHAIN_ID, { includeInactive: true }),
        getV3HostBookings(ACTIVE_CHAIN_ID, address),
        getV3TokenInfo(ACTIVE_CHAIN_ID),
        getV3PendingWithdrawal(ACTIVE_CHAIN_ID, address),
      ])
      const owned = allListings.filter((listing) => listing.owner.toLowerCase() === address.toLowerCase())
      const [hydrated, disputeStates] = await Promise.all([
        Promise.all(owned.map(async (listing) => ({ listing, rooms: (await getV3ListingWithRooms(ACTIVE_CHAIN_ID, listing.id)).rooms }))),
        Promise.all(
          hostBookings
            .filter((booking) => Number(booking.status) === 5)
            .map(async (booking) => [booking.id.toString(), await getV3DisputeInfo(ACTIVE_CHAIN_ID, booking.id)])
        ),
      ])
      setProperties(hydrated)
      setBookings([...hostBookings].reverse())
      setToken(tokenInfo)
      setPendingWithdrawal(withdrawal)
      setDisputes(Object.fromEntries(disputeStates))
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [address, configured])

  useEffect(() => {
    const timeout = setTimeout(refresh, 0)
    return () => clearTimeout(timeout)
  }, [refresh])

  const run = async (method, args, success, key = method) => {
    setBusyAction(key)
    setTransactionState(null)
    try {
      ensureWriteReady()
      await sendV3Action(walletClient, ACTIVE_CHAIN_ID, method, args, setTransactionState)
      toast.success(success)
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  const signAuthorization = async (bookingId) => {
    const key = `sign-${bookingId}`
    setBusyAction(key)
    try {
      ensureWriteReady()
      const authorization = await signCheckInAuthorization(walletClient, ACTIVE_CHAIN_ID, bookingId)
      const serialized = serializeAuthorization(authorization)
      const deepLink = `${window.location.origin}/check-in?authorization=${encodeAuthorization(serialized)}`
      const QRCode = (await import('qrcode')).default
      const qrDataURL = await QRCode.toDataURL(deepLink, { errorCorrectionLevel: 'M', margin: 1, width: 320 })
      setAuthorizations((current) => ({ ...current, [bookingId]: { serialized, deepLink, qrDataURL } }))
      toast.success('Guest-bound authorization signed locally.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied.`)
    } catch {
      toast.error('Clipboard access was unavailable.')
    }
  }

  const updateRoomDraft = (listingId, field, value) => {
    setRoomDrafts((current) => ({
      ...current,
      [listingId]: { name: '', metadataURI: '', price: '', capacity: 1, ...(current[listingId] || {}), [field]: value },
    }))
  }

  const updateRoomEdit = (roomId, field, value) => {
    setRoomEdits((current) => ({ ...current, [roomId]: { ...(current[roomId] || {}), [field]: value } }))
  }

  const updateListingEdit = (listingId, field, value) => {
    setListingEdits((current) => ({ ...current, [listingId]: { ...(current[listingId] || {}), [field]: value } }))
  }

  const addRoom = async (listingId) => {
    const draft = roomDrafts[listingId]
    if (!draft?.name || !draft?.metadataURI || !draft?.price) {
      toast.error('Complete all room fields.')
      return
    }
    if (!token) return
    await run(
      'addRoomType',
      [listingId, draft.name.trim(), draft.metadataURI.trim(), parseTokenAmount(draft.price, token.decimals), Number(draft.capacity)],
      'Room type added.',
      `add-room-${listingId}`
    )
    setRoomDrafts((current) => ({ ...current, [listingId]: null }))
  }

  const updateRoomPrice = async (room) => {
    const value = roomEdits[room.id]?.price
    if (!value || Number(value) <= 0 || !token) return toast.error('Enter a valid higher or lower future price.')
    const atomic = parseTokenAmount(value, token.decimals)
    await run('updateRoomTypePrice', [room.id, atomic], 'Future room price updated.', `price-${room.id}`)
  }

  const increaseRoomCapacity = async (room) => {
    const value = Number(roomEdits[room.id]?.capacity)
    if (!Number.isSafeInteger(value) || value <= Number(room.capacity)) return toast.error('New capacity must be greater than current capacity.')
    await run('increaseRoomTypeCapacity', [room.id, value], 'Room capacity increased.', `capacity-${room.id}`)
  }

  const increaseListingRooms = async (listing) => {
    const value = Number(listingEdits[listing.id]?.totalRooms)
    if (!Number.isSafeInteger(value) || value <= Number(listing.totalRooms)) return toast.error('New inventory must exceed current total rooms.')
    await run('increaseListingRooms', [listing.id, value], 'Listing inventory increased.', `listing-rooms-${listing.id}`)
  }

  const openDispute = async (booking) => {
    const key = `dispute-${booking.id}`
    setBusyAction(key)
    setTransactionState(null)
    try {
      ensureWriteReady()
      await approveAndOpenDispute(
        walletClient,
        ACTIVE_CHAIN_ID,
        booking.id,
        hashEvidenceReference(evidence[booking.id]),
        setTransactionState
      )
      toast.success('Dispute opened. The host bond is now held in escrow.')
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <>
      <Head><title>Host dashboard · HospitalityBooking V3</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader
          eyebrow="Host dashboard · V3"
          title="Properties, inventory, and arrivals"
          description="Manage future inventory without deleting history, sign guest-bound check-ins, and withdraw only after the contract credits a settlement."
          actions={<Link href="/manage/new" className="button-primary inline-flex">Create property</Link>}
        />

        {!configured && <EmptyState title="V3 deployment not configured" description={`Add the finalized ${chain.name} addresses before loading host records.`} />}
        {configured && !address && <WalletPrompt role="host wallet" />}
        {loadError && <p className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</p>}

        {address && token && (
          <section className="mb-7 rounded-3xl bg-slate-950 p-6 text-white shadow-lg shadow-slate-900/10">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Host withdrawal</p><p className="mt-2 text-3xl font-semibold">{formatTokenAmount(pendingWithdrawal, token.decimals, token.symbol)}</p><p className="mt-2 text-sm text-slate-400">Checked-in stay revenue remains escrowed through the dispute window.</p></div>
              <button type="button" disabled={pendingWithdrawal === 0n || Boolean(busyAction)} onClick={() => run('withdraw', [], 'Withdrawal finalized.', 'withdraw')} className="inline-flex rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{busyAction === 'withdraw' ? 'Withdrawing…' : 'Withdraw balance'}</button>
            </div>
          </section>
        )}

        <TransactionStatus transaction={transactionState} chainId={chain.id} />
        {loading && <LoadingState label="Loading host records…" />}

        {!loading && configured && address && properties.length === 0 && (
          <EmptyState title="No properties owned by this wallet" description="Create a V3 property, then add room types within its declared inventory." actionHref="/manage/new" actionLabel="Create a property" />
        )}

        <section className="mt-7 grid gap-6">
          {properties.map(({ listing, rooms }) => {
            const draft = roomDrafts[listing.id] || { name: '', metadataURI: '', price: '', capacity: 1 }
            const availableCapacity = Number(listing.totalRooms) - Number(listing.allocatedCapacity)
            return (
              <article key={listing.id} className="app-card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                  <div><p className="eyebrow">Listing #{listing.id.toString()}</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">{listing.name}</h2><p className="mt-2 text-sm text-slate-500">{listing.allocatedCapacity.toString()} of {listing.totalRooms.toString()} rooms allocated across {rooms.length} room types</p></div>
                  <button type="button" disabled={Boolean(busyAction)} onClick={() => run('setListingActive', [listing.id, !listing.active], listing.active ? 'Listing deactivated.' : 'Listing reactivated.', `listing-active-${listing.id}`)} className={listing.active ? 'button-danger inline-flex' : 'button-secondary inline-flex'}>{listing.active ? 'Deactivate listing' : 'Reactivate listing'}</button>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="grid gap-3 md:grid-cols-2">
                    {rooms.map((room) => (
                      <div key={room.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{room.name}</h3><p className="mt-1 text-xs text-slate-500">Room #{room.id.toString()} · capacity {room.capacity.toString()}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${room.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{room.active ? 'Active' : 'Inactive'}</span></div>
                        <p className="mt-3 text-sm font-semibold">{formatTokenAmount(room.pricePerNight, token.decimals, token.symbol)} / night</p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div><input value={roomEdits[room.id]?.price || ''} onChange={(event) => updateRoomEdit(room.id, 'price', event.target.value)} inputMode="decimal" placeholder={`New ${token.symbol} price`} className="field mt-0" /><button type="button" disabled={Boolean(busyAction)} onClick={() => updateRoomPrice(room)} className="button-secondary mt-2 inline-flex w-full">Update price</button></div>
                          <div><input type="number" min={Number(room.capacity) + 1} value={roomEdits[room.id]?.capacity || ''} onChange={(event) => updateRoomEdit(room.id, 'capacity', event.target.value)} placeholder={`>${room.capacity}`} className="field mt-0" /><button type="button" disabled={Boolean(busyAction)} onClick={() => increaseRoomCapacity(room)} className="button-secondary mt-2 inline-flex w-full">Increase capacity</button></div>
                        </div>
                        <button type="button" disabled={Boolean(busyAction)} onClick={() => run('setRoomTypeActive', [room.id, !room.active], room.active ? 'Room type deactivated.' : 'Room type reactivated.', `room-active-${room.id}`)} className="mt-3 text-xs font-semibold text-slate-600 hover:text-slate-950">{room.active ? 'Deactivate room type' : 'Reactivate room type'}</button>
                      </div>
                    ))}
                  </div>

                  <details className="mt-5 rounded-2xl border border-slate-200 p-4">
                    <summary className="cursor-pointer font-semibold text-slate-950">Inventory controls</summary>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">Increase listing inventory</p><p className="mt-1 text-xs text-slate-500">Current total: {listing.totalRooms.toString()}. Totals cannot decrease.</p><div className="mt-3 flex gap-2"><input type="number" min={Number(listing.totalRooms) + 1} value={listingEdits[listing.id]?.totalRooms || ''} onChange={(event) => updateListingEdit(listing.id, 'totalRooms', event.target.value)} placeholder="New total" className="field mt-0" /><button type="button" disabled={Boolean(busyAction)} onClick={() => increaseListingRooms(listing)} className="button-secondary inline-flex">Increase</button></div></div>
                      <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">Add a room type</p><p className="mt-1 text-xs text-slate-500">Unallocated listing capacity: {availableCapacity}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={draft.name} onChange={(event) => updateRoomDraft(listing.id, 'name', event.target.value)} placeholder="Room name" className="field mt-0" /><input value={draft.metadataURI} onChange={(event) => updateRoomDraft(listing.id, 'metadataURI', event.target.value)} placeholder="ipfs:// metadata" className="field mt-0" /><input value={draft.price} onChange={(event) => updateRoomDraft(listing.id, 'price', event.target.value)} inputMode="decimal" placeholder={`Price in ${token.symbol}`} className="field mt-0" /><div className="flex gap-2"><input type="number" min="1" max={Math.max(1, availableCapacity)} value={draft.capacity} onChange={(event) => updateRoomDraft(listing.id, 'capacity', event.target.value)} className="field mt-0" /><button type="button" disabled={availableCapacity < 1 || Boolean(busyAction)} onClick={() => addRoom(listing.id)} className="button-primary inline-flex">Add</button></div></div></div>
                    </div>
                  </details>
                </div>
              </article>
            )
          })}
        </section>

        <section className="mt-12">
          <div className="mb-5"><p className="eyebrow">Arrival operations</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Bookings requiring host attention</h2></div>
          {!loading && configured && address && bookings.length === 0 && <EmptyState title="No host bookings yet" description="New bookings for your properties will appear here." />}
          <div className="grid gap-5">
            {bookings.map((booking) => {
              const id = booking.id.toString()
              const status = BOOKING_STATUS[Number(booking.status)]
              const authorization = authorizations[id]
              const now = currentTimestamp
              const disputeWindowEnd = Number(booking.scheduledCheckout) + POST_CHECKOUT_DISPUTE_WINDOW
              const canNoShow = status === 'Booked' && now > Number(booking.checkInDeadline)
              const canComplete = status === 'CheckedIn' && now > disputeWindowEnd
              const canOpenDispute = status === 'Booked' || (status === 'CheckedIn' && now <= disputeWindowEnd)
              const dispute = disputes[id]
              const canTimeout = status === 'Disputed' && dispute?.deadline > 0 && now > dispute.deadline
              const bond = token ? (booking.escrowedAmount * BigInt(token.disputeBondBps) + 9_999n) / 10_000n : 0n
              return (
                <article key={id} className="app-card p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="eyebrow">Booking #{id}</p><h3 className="mt-2 text-lg font-semibold text-slate-950">Listing #{booking.listingId.toString()}</h3><p className="mt-1 text-sm text-slate-600">Guest <AddressLink chainId={chain.id} address={booking.guest} /> · {formatEpochDay(booking.checkInDay)} → {formatEpochDay(booking.checkOutDay)}</p></div>
                    <StatusBadge status={status} />
                  </div>

                  {status === 'Booked' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={Boolean(busyAction)} onClick={() => signAuthorization(id)} className="button-primary inline-flex">{busyAction === `sign-${id}` ? 'Signing…' : 'Sign guest check-in'}</button>
                      <button type="button" disabled={Boolean(busyAction)} onClick={() => run('revokeCheckInAuthorization', [booking.id], 'Outstanding authorizations revoked.', `revoke-${id}`)} className="button-secondary inline-flex">Revoke nonce</button>
                      {canNoShow && <button type="button" disabled={Boolean(busyAction)} onClick={() => run('settleNoShow', [booking.id], 'No-show settled.', `no-show-${id}`)} className="button-secondary inline-flex">Settle no-show</button>}
                    </div>
                  )}

                  {status === 'CheckedIn' && (
                    <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"><p>Host payout remains escrowed through {formatTimestamp(disputeWindowEnd)}.</p>{canComplete && <button type="button" disabled={Boolean(busyAction)} onClick={() => run('completeStay', [booking.id], 'Stay completed.', `complete-${id}`)} className="button-primary mt-3 inline-flex">Complete stay</button>}</div>
                  )}

                  {authorization && (
                    <div className="mt-4 grid gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:grid-cols-[1fr_190px]">
                      <div><p className="text-xs font-bold uppercase tracking-wide text-teal-900">Guest-bound authorization</p><textarea readOnly value={authorization.serialized} className="field mt-2 h-40 font-mono text-[10px]" /><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => copyText(authorization.serialized, 'Authorization')} className="button-secondary inline-flex">Copy JSON</button><button type="button" onClick={() => copyText(authorization.deepLink, 'Check-in link')} className="button-secondary inline-flex">Copy link</button></div></div>
                      <div><img src={authorization.qrDataURL} alt={`Guest check-in QR code for booking ${id}`} className="w-full rounded-2xl border border-teal-200 bg-white p-2" /><a href={authorization.deepLink} className="mt-2 block break-all text-xs font-semibold text-teal-800 underline">Open check-in link</a></div>
                    </div>
                  )}

                  {canOpenDispute && (
                    <details className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><summary className="cursor-pointer font-semibold text-amber-950">Open host dispute</summary><p className="mt-2 text-xs leading-5 text-amber-900">Required bond: {token ? formatTokenAmount(bond, token.decimals, token.symbol) : '—'}. A loss or timeout forfeits it to the guest.</p><input value={evidence[id] || ''} onChange={(event) => setEvidence((current) => ({ ...current, [id]: event.target.value }))} placeholder="ipfs:// evidence or immutable reference" className="field" />{evidence[id] && <code className="mt-2 block break-all text-[10px]">Hash: {hashEvidenceReference(evidence[id])}</code>}<button type="button" disabled={!evidence[id]?.trim() || Boolean(busyAction)} onClick={() => openDispute(booking)} className="button-danger mt-3 inline-flex">Approve bond and open</button></details>
                  )}

                  {status === 'Disputed' && dispute && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Dispute settlement is frozen.</p><p className="mt-1 text-xs">Arbitrator deadline: {formatTimestamp(dispute.deadline)}</p><code className="mt-2 block break-all text-[10px]">Evidence: {dispute.evidenceHash}</code>{canTimeout && <button type="button" disabled={Boolean(busyAction)} onClick={() => run('resolveDisputeAfterDeadline', [booking.id], 'Timed-out dispute resolved in the guest’s favor.', `timeout-${id}`)} className="button-danger mt-3 inline-flex">Resolve expired dispute</button>}</div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
}
