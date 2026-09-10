import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import {
  BOOKING_STATUS,
  getV3GuestBookings,
  getV3PendingWithdrawal,
  getV3TokenInfo,
  reviewContentHash,
  sendV3Action,
  submitCheckIn,
} from '@/services/blockchain'
import { epochDayToDateString } from '@/utils/dates'

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 80002)

const errorMessage = (error) => error?.shortMessage || error?.message || 'Transaction failed'

export default function MyBookings() {
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [bookings, setBookings] = useState([])
  const [token, setToken] = useState(null)
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0n)
  const [loading, setLoading] = useState(false)
  const [authorization, setAuthorization] = useState({})
  const [reviews, setReviews] = useState({})
  const [reviewHashes, setReviewHashes] = useState({})

  const refresh = useCallback(async () => {
    if (!address) {
      setBookings([])
      setPendingWithdrawal(0n)
      return
    }
    setLoading(true)
    try {
      const [nextBookings, tokenInfo, withdrawal] = await Promise.all([
        getV3GuestBookings(CHAIN_ID, address),
        getV3TokenInfo(CHAIN_ID),
        getV3PendingWithdrawal(CHAIN_ID, address),
      ])
      setBookings([...nextBookings].reverse())
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

  const checkIn = async (bookingId) => {
    try {
      const parsed = JSON.parse(authorization[bookingId] || '')
      await submitCheckIn(
        walletClient,
        CHAIN_ID,
        {
          bookingId: BigInt(parsed.bookingId),
          validAfter: BigInt(parsed.validAfter),
          validUntil: BigInt(parsed.validUntil),
          nonce: BigInt(parsed.nonce),
          signature: parsed.signature,
        }
      )
      toast.success('Host-authorized check-in finalized.')
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
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
      schema: 'hospitality-booking-v3/review/1',
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
    try {
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
      await submitReviewToRegistry(walletClient, CHAIN_ID, {
        bookingId: booking.id,
        rating: Number(content.rating),
        uri: result.uri,
        contentHash: hash,
      })
      toast.success('Review pinned and recorded on-chain.')
      await refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#00773d]">V3</p>
          <h1 className="text-3xl font-semibold text-slate-900">My trips and booking passes</h1>
          <p className="mt-1 text-sm text-slate-600">Host authorization is required for check-in.</p>
        </div>
      </div>

      {address && token && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs uppercase text-slate-500">Withdrawable balance</p>
            <p className="text-2xl font-semibold text-slate-900">
              {ethers.formatUnits(pendingWithdrawal, token.decimals)} {token.symbol}
            </p>
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

      {!address && <p className="rounded-xl border border-dashed p-8 text-center">Connect a wallet to load V3 trips.</p>}
      {loading && <p className="text-sm text-slate-500">Loading V3 bookings…</p>}
      {!loading && address && bookings.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-center">No V3 bookings found.</p>
      )}

      <div className="grid gap-5">
        {bookings.map((booking) => {
          const status = BOOKING_STATUS[Number(booking.status)]
          const reviewDraft = reviews[booking.id] || { rating: 5, text: '' }
          return (
            <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">Booking #{booking.id.toString()}</p>
                  <h2 className="mt-1 text-lg font-semibold">Listing #{booking.listingId.toString()}</h2>
                  <p className="text-sm text-slate-600">
                    {epochDayToDateString(booking.checkInDay)} → {epochDayToDateString(booking.checkOutDay)} (exclusive)
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{status}</span>
              </div>

              {status === 'Booked' && (
                <div className="mt-5 grid gap-3">
                  <textarea
                    value={authorization[booking.id] || ''}
                    onChange={(event) =>
                      setAuthorization((current) => ({ ...current, [booking.id]: event.target.value }))
                    }
                    placeholder="Paste the host-signed check-in authorization JSON"
                    className="min-h-[90px] rounded-xl border border-slate-300 p-3 text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => checkIn(booking.id)} className="rounded-xl bg-[#00773d] px-4 py-2 text-sm font-semibold text-white">
                      Submit check-in
                    </button>
                    <button type="button" onClick={() => run('cancelBooking', [booking.id], 'Booking cancelled.')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
                      Cancel before check-in
                    </button>
                    <button type="button" onClick={() => run('settleNoShow', [booking.id], 'No-show settled.')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
                      Settle no-show if window closed
                    </button>
                  </div>
                </div>
              )}

              {(status === 'CheckedIn' || status === 'Completed') && !booking.reviewSubmitted && (
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
                    <select
                      value={reviewDraft.rating}
                      onChange={(event) => updateReview(booking.id, 'rating', event.target.value)}
                      className="rounded-xl border border-slate-300 p-3"
                    >
                      {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}
                    </select>
                    <textarea
                      value={reviewDraft.text}
                      onChange={(event) => updateReview(booking.id, 'text', event.target.value)}
                      placeholder="Review stored as canonical JSON on IPFS"
                      className="rounded-xl border border-slate-300 p-3"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => previewReviewHash(booking)} className="rounded-xl border px-3 py-2 text-sm font-semibold">Calculate hash</button>
                    <button type="button" onClick={() => submitReview(booking)} className="rounded-xl bg-[#00773d] px-3 py-2 text-sm font-semibold text-white">Pin and submit</button>
                    {reviewHashes[booking.id] && <code className="break-all text-[10px]">{reviewHashes[booking.id]}</code>}
                  </div>
                </div>
              )}

              {status === 'CheckedIn' && (
                <button type="button" onClick={() => run('completeStay', [booking.id], 'Stay completed.')} className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold">
                  Complete after checkout
                </button>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
