import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { toast } from 'react-toastify'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import {
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  TransactionStatus,
  WalletPrompt,
} from '@/components/AppUI'
import { ACTIVE_CHAIN_ID, getChainConfig, isDeploymentConfigured } from '@/config/chains'
import {
  BOOKING_STATUS,
  approveAndOpenDispute,
  getDisputeInfo,
  getGuestBookings,
  getPendingWithdrawal,
  getPaymentTokenInfo,
  hasReviewed,
  hashEvidenceReference,
  reviewContentHash,
  sendBookingAction,
  submitCheckIn,
  submitReview as submitReviewToRegistry,
} from '@/services/blockchain'
import { formatEpochDay } from '@/utils/dates'
import { parseCheckInAuthorization } from '@/utils/checkInAuthorization'
import { formatTokenAmount } from '@/utils/token'

const POST_CHECKOUT_DISPUTE_WINDOW = 86_400
const errorMessage = (error) => error?.shortMessage || error?.message || 'Transaction failed'

function formatTimestamp(seconds) {
  if (!seconds) return 'Not available'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(Number(seconds) * 1000))
}

export default function MyBookings() {
  const chain = getChainConfig(ACTIVE_CHAIN_ID)
  const configured = isDeploymentConfigured(ACTIVE_CHAIN_ID)
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [bookings, setBookings] = useState([])
  const [token, setToken] = useState(null)
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0n)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [authorization, setAuthorization] = useState({})
  const [reviews, setReviews] = useState({})
  const [reviewHashes, setReviewHashes] = useState({})
  const [reviewedBookings, setReviewedBookings] = useState({})
  const [disputes, setDisputes] = useState({})
  const [evidence, setEvidence] = useState({})
  const [transactionState, setTransactionState] = useState(null)
  const [busyAction, setBusyAction] = useState(null)
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
    if (!walletClient) throw new Error('Connect your wallet first')
    if (Number(activeChainId) !== ACTIVE_CHAIN_ID)
      throw new Error(`Switch your wallet to ${chain.name}`)
  }

  const refresh = useCallback(async () => {
    if (!address || !configured) {
      setBookings([])
      setPendingWithdrawal(0n)
      setReviewedBookings({})
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const [nextBookings, tokenInfo, withdrawal] = await Promise.all([
        getGuestBookings(ACTIVE_CHAIN_ID, address),
        getPaymentTokenInfo(ACTIVE_CHAIN_ID),
        getPendingWithdrawal(ACTIVE_CHAIN_ID, address),
      ])
      const [reviewStates, disputeStates] = await Promise.all([
        Promise.all(
          nextBookings.map(async (booking) => [
            booking.id.toString(),
            await hasReviewed(ACTIVE_CHAIN_ID, booking.id),
          ])
        ),
        Promise.all(
          nextBookings
            .filter((booking) => Number(booking.status) === 5)
            .map(async (booking) => [
              booking.id.toString(),
              await getDisputeInfo(ACTIVE_CHAIN_ID, booking.id),
            ])
        ),
      ])
      setBookings([...nextBookings].reverse())
      setToken(tokenInfo)
      setPendingWithdrawal(withdrawal)
      setReviewedBookings(Object.fromEntries(reviewStates))
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
      await sendBookingAction(walletClient, ACTIVE_CHAIN_ID, method, args, setTransactionState)
      toast.success(success)
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  const checkInAttested = async (bookingId) => {
    const key = `check-in-attested-${bookingId}`
    setBusyAction(key)
    setTransactionState(null)
    try {
      ensureWriteReady()
      const parsed = parseCheckInAuthorization(authorization[bookingId], {
        chainId: ACTIVE_CHAIN_ID,
        verifyingContract: chain.bookingAddress,
        guest: address,
      })
      if (parsed.bookingId !== BigInt(bookingId))
        throw new Error('Authorization belongs to another booking')
      await submitCheckIn(walletClient, ACTIVE_CHAIN_ID, parsed, setTransactionState)
      toast.success('Host-authorized check-in finalized.')
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  const openDispute = async (booking) => {
    const key = `dispute-${booking.id}`
    setBusyAction(key)
    setTransactionState(null)
    try {
      ensureWriteReady()
      const evidenceHash = hashEvidenceReference(evidence[booking.id])
      await approveAndOpenDispute(
        walletClient,
        ACTIVE_CHAIN_ID,
        booking.id,
        evidenceHash,
        setTransactionState
      )
      toast.success('Dispute opened. The bond is held until resolution.')
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  const updateReview = (bookingId, field, value) => {
    setReviews((current) => ({
      ...current,
      [bookingId]: { rating: 5, text: '', ...(current[bookingId] || {}), [field]: value },
    }))
  }

  const previewReviewHash = (booking) => {
    const draft = reviews[booking.id] || { rating: 5, text: '' }
    const content = {
      schema: 'hospitality-booking/review/1',
      bookingId: booking.id.toString(),
      listingId: booking.listingId.toString(),
      rating: Number(draft.rating),
      review: String(draft.text || '').trim(),
      reviewer: address,
    }
    const hash = reviewContentHash(content)
    setReviewHashes((current) => ({ ...current, [booking.id]: hash }))
    return { content, hash }
  }

  const submitReview = async (booking) => {
    const key = `review-${booking.id}`
    setBusyAction(key)
    setTransactionState(null)
    try {
      ensureWriteReady()
      const { content, hash } = previewReviewHash(booking)
      if (!content.review) throw new Error('Write a review first')
      const response = await fetch('/api/pinata/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hospitality-CSRF': '1' },
        body: JSON.stringify({
          type: 'json',
          content,
          pinName: `review-booking-${booking.id}.json`,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Review pinning failed')
      await submitReviewToRegistry(
        walletClient,
        ACTIVE_CHAIN_ID,
        {
          bookingId: booking.id,
          rating: Number(content.rating),
          uri: result.uri,
          contentHash: hash,
        },
        setTransactionState
      )
      toast.success('Review pinned and recorded on-chain.')
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <>
      <Head>
        <title>My trips · HospitalityBooking</title>
      </Head>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader
          eyebrow="Guest dashboard"
          title="Trips, passes, and settlements"
          description="Manage guest actions against the finalized booking lifecycle. Every write is confirmed before this page refreshes its on-chain state."
          actions={
            <Link href="/" className="button-secondary inline-flex">
              Explore stays
            </Link>
          }
        />

        {!configured && (
          <EmptyState
            title="Deployment not configured"
            description={`Add the finalized ${chain.name} addresses before loading guest records.`}
          />
        )}
        {configured && !address && (
          <WalletPrompt description="Connect the guest wallet that created the bookings." />
        )}
        {loadError && (
          <p className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {loadError}
          </p>
        )}

        {address && token && (
          <section className="mb-7 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-lg shadow-slate-900/10">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
                  Available to withdraw
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatTokenAmount(pendingWithdrawal, token.decimals, token.symbol)}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Credits stay on-chain until this wallet pulls them.
                </p>
              </div>
              <button
                type="button"
                disabled={pendingWithdrawal === 0n || Boolean(busyAction)}
                onClick={() => run('withdraw', [], 'Withdrawal finalized.', 'withdraw')}
                className="inline-flex rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40"
              >
                {busyAction === 'withdraw' ? 'Withdrawing…' : 'Withdraw balance'}
              </button>
            </div>
          </section>
        )}

        <TransactionStatus transaction={transactionState} chainId={chain.id} />
        {loading && <LoadingState label="Loading guest bookings…" />}
        {!loading && configured && address && bookings.length === 0 && (
          <EmptyState
            title="No trips yet"
            description="Your future and historical bookings will appear here."
            actionHref="/"
            actionLabel="Find a property"
          />
        )}

        <div className="mt-6 grid gap-5">
          {bookings.map((booking) => {
            const id = booking.id.toString()
            const status = BOOKING_STATUS[Number(booking.status)]
            const now = currentTimestamp
            const checkIn = Number(booking.scheduledCheckIn)
            const checkInDeadline = Number(booking.checkInDeadline)
            const disputeWindowEnd =
              Number(booking.scheduledCheckout) + POST_CHECKOUT_DISPUTE_WINDOW
            const dispute = disputes[id]
            const canCancel = status === 'Booked' && now < checkIn
            const canCheckIn = status === 'Booked' && now >= checkIn && now <= checkInDeadline
            const canNoShow = status === 'Booked' && now > checkInDeadline
            const canOpenDispute =
              status === 'Booked' || (status === 'CheckedIn' && now <= disputeWindowEnd)
            const canComplete = status === 'CheckedIn' && now > disputeWindowEnd
            const canTimeout =
              status === 'Disputed' && dispute?.deadline > 0 && now > dispute.deadline
            const canReview = ['CheckedIn', 'Completed', 'ResolvedGuest', 'ResolvedHost'].includes(
              status
            )
            const reviewDraft = reviews[id] || { rating: 5, text: '' }
            const bond = token
              ? (booking.escrowedAmount * BigInt(token.disputeBondBps) + 9_999n) / 10_000n
              : 0n

            return (
              <article key={id} className="app-card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                  <div>
                    <p className="eyebrow">Booking #{id}</p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">
                      Listing #{booking.listingId.toString()}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      {formatEpochDay(booking.checkInDay)} → {formatEpochDay(booking.checkOutDay)}{' '}
                      <span className="text-slate-400">(exclusive)</span>
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="grid gap-4 bg-slate-50/70 px-5 py-4 text-sm sm:grid-cols-3 sm:px-6">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Escrowed</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {token
                        ? formatTokenAmount(booking.escrowedAmount, token.decimals, token.symbol)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Check-in opens</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatTimestamp(checkIn)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Scheduled checkout
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatTimestamp(booking.scheduledCheckout)}
                    </p>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {status === 'Booked' && (
                    <section className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-950">Check-in options</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Check in from {formatTimestamp(checkIn)} through{' '}
                            {formatTimestamp(checkInDeadline)}. A host signature provides stronger
                            review provenance but is not required.
                          </p>
                        </div>
                        <Link
                          href="/check-in"
                          className="text-xs font-semibold text-teal-700 hover:underline"
                        >
                          Open dedicated page →
                        </Link>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Guest-controlled fallback
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Prevents a host from blocking check-in; reviews receive the configured
                            unattested weight.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!canCheckIn || Boolean(busyAction)}
                          onClick={() =>
                            run(
                              'checkIn',
                              [booking.id],
                              'Guest-controlled check-in finalized.',
                              `check-in-direct-${id}`
                            )
                          }
                          className="button-secondary inline-flex"
                        >
                          {busyAction === `check-in-direct-${id}`
                            ? 'Checking in…'
                            : 'Check in without signature'}
                        </button>
                      </div>
                      <label className="mt-4 block text-sm font-medium text-slate-800">
                        Host authorization JSON
                      </label>
                      <textarea
                        value={authorization[id] || ''}
                        onChange={(event) =>
                          setAuthorization((current) => ({ ...current, [id]: event.target.value }))
                        }
                        placeholder="Paste the guest-bound authorization JSON from the host"
                        className="field mt-4 min-h-24 font-mono text-xs"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!canCheckIn || Boolean(busyAction) || !authorization[id]}
                          onClick={() => checkInAttested(id)}
                          className="button-primary inline-flex"
                        >
                          {busyAction === `check-in-attested-${id}`
                            ? 'Checking in…'
                            : 'Submit host-authorized check-in'}
                        </button>
                        {canCancel && (
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() =>
                              run(
                                'cancelBooking',
                                [booking.id],
                                'Booking cancelled.',
                                `cancel-${id}`
                              )
                            }
                            className="button-secondary inline-flex"
                          >
                            Cancel booking
                          </button>
                        )}
                        {canNoShow && (
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() =>
                              run('settleNoShow', [booking.id], 'No-show settled.', `no-show-${id}`)
                            }
                            className="button-secondary inline-flex"
                          >
                            Settle no-show
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {status === 'CheckedIn' && (
                    <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
                      <p className="font-semibold">
                        Security deposit returned; stay payout remains escrowed.
                      </p>
                      <p className="mt-1 text-xs leading-5">
                        A dispute may be opened through {formatTimestamp(disputeWindowEnd)}. If none
                        is opened, anyone may complete the stay after that time.
                      </p>
                      {canComplete && (
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            run('completeStay', [booking.id], 'Stay completed.', `complete-${id}`)
                          }
                          className="button-primary mt-3 inline-flex"
                        >
                          Complete stay
                        </button>
                      )}
                    </div>
                  )}

                  {canOpenDispute && (
                    <details className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <summary className="cursor-pointer font-semibold text-amber-950">
                        Open a bonded dispute
                      </summary>
                      <p className="mt-2 text-xs leading-5 text-amber-900">
                        The opener deposits{' '}
                        {token
                          ? formatTokenAmount(bond, token.decimals, token.symbol)
                          : 'a configured bond'}
                        . It is refunded if the opener wins and forfeited to the other party if the
                        opener loses or misses the resolution deadline.
                      </p>
                      <label className="mt-3 block text-sm font-medium text-amber-950">
                        Evidence URI or public reference
                        <input
                          value={evidence[id] || ''}
                          onChange={(event) =>
                            setEvidence((current) => ({ ...current, [id]: event.target.value }))
                          }
                          placeholder="ipfs://… or another immutable reference"
                          className="field"
                        />
                      </label>
                      {evidence[id] && (
                        <code className="mt-2 block break-all text-[10px] text-amber-900">
                          Hash: {hashEvidenceReference(evidence[id])}
                        </code>
                      )}
                      <button
                        type="button"
                        disabled={!evidence[id]?.trim() || Boolean(busyAction)}
                        onClick={() => openDispute(booking)}
                        className="button-danger mt-3 inline-flex"
                      >
                        {busyAction === `dispute-${id}`
                          ? 'Opening dispute…'
                          : 'Approve bond and open'}
                      </button>
                    </details>
                  )}

                  {status === 'Disputed' && dispute && (
                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <h3 className="font-semibold">Settlement is frozen</h3>
                      <p className="mt-1 text-xs">
                        Arbitrator deadline: {formatTimestamp(dispute.deadline)}
                      </p>
                      <code className="mt-2 block break-all text-[10px]">
                        Evidence hash: {dispute.evidenceHash}
                      </code>
                      {canTimeout ? (
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            run(
                              'resolveDisputeAfterDeadline',
                              [booking.id],
                              'Timed-out dispute resolved in the non-opener’s favor.',
                              `timeout-${id}`
                            )
                          }
                          className="button-danger mt-3 inline-flex"
                        >
                          Resolve expired dispute
                        </button>
                      ) : (
                        <p className="mt-2 text-xs">
                          Permissionless timeout resolution becomes available after the deadline.
                        </p>
                      )}
                    </section>
                  )}

                  {canReview && !reviewedBookings[id] && (
                    <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="font-semibold text-slate-950">Publish your one review</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        The canonical JSON is pinned first; its exact keccak256 hash is then
                        recorded on-chain.
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[110px_1fr]">
                        <select
                          aria-label={`Rating for booking ${id}`}
                          value={reviewDraft.rating}
                          onChange={(event) => updateReview(id, 'rating', event.target.value)}
                          className="field mt-0"
                        >
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating} / 5
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={reviewDraft.text}
                          onChange={(event) => updateReview(id, 'text', event.target.value)}
                          placeholder="Describe the stay"
                          maxLength={5000}
                          className="field mt-0 min-h-24"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => previewReviewHash(booking)}
                          className="button-secondary inline-flex"
                        >
                          Calculate hash
                        </button>
                        <button
                          type="button"
                          disabled={!reviewDraft.text.trim() || Boolean(busyAction)}
                          onClick={() => submitReview(booking)}
                          className="button-primary inline-flex"
                        >
                          {busyAction === `review-${id}` ? 'Publishing…' : 'Pin and submit'}
                        </button>
                      </div>
                      {reviewHashes[id] && (
                        <code className="mt-3 block break-all rounded-lg bg-white p-2 text-[10px]">
                          {reviewHashes[id]}
                        </code>
                      )}
                    </section>
                  )}

                  {reviewedBookings[id] && (
                    <p className="mt-4 text-sm font-medium text-emerald-700">
                      Review recorded for this booking.
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </>
  )
}
