import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Modal from 'react-modal'
import { toast } from 'react-toastify'
import { useAccount } from 'wagmi'
import {
  addReview,
  checkInApartment,
  getChainNowSeconds,
  getMyBookings,
  getOwnedTokens,
  refundBooking,
  tenantBooked,
} from '@/services/blockchain'
import { formatDate, normalizeIpfsUrl, toMillis, truncate } from '@/utils/helper'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const parseTokenMetadata = async (token) => {
  const uri = token.metadataUri || ''
  if (!uri) return null
  if (uri.startsWith('data:application/json;base64,')) {
    const base64 = uri.replace('data:application/json;base64,', '')
    return JSON.parse(atob(base64))
  }
  const response = await fetch(normalizeIpfsUrl(uri))
  return response.json()
}

const BookingPage = () => {
  const { address } = useAccount()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [tokenMap, setTokenMap] = useState({})
  const [chainNowSec, setChainNowSec] = useState(null)
  const [refundTarget, setRefundTarget] = useState(null)
  const [reviewText, setReviewText] = useState({})
  const [reviewableByAid, setReviewableByAid] = useState({})
  const [reviewing, setReviewing] = useState({})

  useEffect(() => {
    const loadChainTime = async () => {
      try {
        setChainNowSec(await getChainNowSeconds())
      } catch (error) {
        console.error('Failed to load chain time:', error)
      }
    }

    loadChainTime()
  }, [])

  useEffect(() => {
    const loadBookings = async () => {
      if (!address) {
        setBookings([])
        return
      }

      try {
        setLoading(true)
        const data = await getMyBookings(address)
        setBookings(data)
      } catch (error) {
        console.error('Failed to load user bookings:', error)
        setBookings([])
      } finally {
        setLoading(false)
      }
    }

    loadBookings()
  }, [address])

  useEffect(() => {
    const loadTokens = async () => {
      if (!address) {
        setTokenMap({})
        return
      }

      try {
        const tokens = await getOwnedTokens(address)
        const parsed = await Promise.all(
          tokens.map(async (token) => {
            try {
              const metadata = await parseTokenMetadata(token)
              return [
                token.id,
                {
                  name: metadata?.name || `Hospitality NFT #${token.id}`,
                  description: metadata?.description || '',
                  image: normalizeIpfsUrl(metadata?.image || ''),
                },
              ]
            } catch (error) {
              console.warn(`Failed to parse token ${token.id} metadata:`, error)
              return [token.id, null]
            }
          })
        )
        setTokenMap(Object.fromEntries(parsed.filter((entry) => entry[1])))
      } catch (error) {
        console.error('Failed to load owned tokens:', error)
        setTokenMap({})
      }
    }

    loadTokens()
  }, [address])

  useEffect(() => {
    const loadReviewable = async () => {
      if (!address || bookings.length === 0) {
        setReviewableByAid({})
        return
      }

      const uniqueAids = Array.from(new Set(bookings.map((booking) => booking.aid)))
      const results = await Promise.all(
        uniqueAids.map(async (aid) => {
          try {
            const canReview = await tenantBooked(aid)
            return [aid, Boolean(canReview)]
          } catch (error) {
            console.error(`Failed to check review eligibility for ${aid}:`, error)
            return [aid, false]
          }
        })
      )
      setReviewableByAid(Object.fromEntries(results))
    }

    loadReviewable()
  }, [address, bookings])

  const onCheckIn = (booking) => {
    toast.promise(
      new Promise((resolve, reject) => {
        checkInApartment(booking.aid, booking.id)
          .then((tx) => resolve(tx))
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Checked in successfully.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  const confirmRefund = () => {
    if (!refundTarget) return
    toast.promise(
      new Promise((resolve, reject) => {
        refundBooking(refundTarget.aid, refundTarget.id)
          .then((tx) => resolve(tx))
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approving refund...',
        success: 'Refund processed successfully.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
    setRefundTarget(null)
  }

  const handleReviewSubmit = async (booking) => {
    const text = reviewText[booking.aid]?.trim()
    if (!text) {
      toast.error('Please write a review first.')
      return
    }

    setReviewing((prev) => ({ ...prev, [booking.aid]: true }))
    try {
      await addReview(booking.aid, text)
      setReviewText((prev) => ({ ...prev, [booking.aid]: '' }))
      toast.success('Review submitted.')
    } catch (error) {
      toast.error(formatToastError(error))
    } finally {
      setReviewing((prev) => ({ ...prev, [booking.aid]: false }))
    }
  }

  const bookingsWithMeta = useMemo(
    () =>
      bookings.map((booking) => ({
        ...booking,
        tokenMeta: tokenMap[booking.tokenId],
      })),
    [bookings, tokenMap]
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">My Trips</h1>
          <p className="text-sm text-slate-600">Manage check-ins, refunds, and reviews.</p>
        </div>
        <Link
          href="/MyNFTs"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#00773d] hover:text-[#00773d]"
        >
          Go to Property Management
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading bookings...</p>}

      {!loading && bookingsWithMeta.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
          No bookings found for this wallet.
        </p>
      )}

      <div className="grid gap-4">
        {bookingsWithMeta.map((booking) => {
          const tokenMeta = booking.tokenMeta
          const checkInDate = booking.checkInDate || 0
          const checkInOpen = chainNowSec
            ? checkInDate <= chainNowSec
            : toMillis(checkInDate) <= Date.now()
          const canCheckIn = !booking.cancelled && !booking.checked && checkInOpen
          const canRefund = !booking.cancelled && !booking.checked && checkInDate > (chainNowSec || 0)
          const canReview = reviewableByAid[booking.aid]

          return (
            <div
              key={`${booking.aid}-${booking.id}-${booking.timestamp}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="grid gap-4 p-4 md:grid-cols-[200px_1fr]">
                <div className="flex flex-col gap-3">
                  {tokenMeta?.image ? (
                    <img
                      src={tokenMeta.image}
                      alt={tokenMeta.name}
                      className="h-40 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">
                      NFT image unavailable
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">NFT</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {tokenMeta?.name || `Hospitality NFT #${booking.tokenId}`}
                    </p>
                    <p className="text-xs text-slate-500">{truncate(tokenMeta?.description || '', 10, 10, 40)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{booking.apartmentName}</p>
                    <p className="text-sm text-slate-500">{booking.apartmentLocation}</p>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>Room Type: {booking.roomTypeName || `#${booking.roomTypeIndex}`}</p>
                    <p>
                      Dates: {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
                    </p>
                    <p>
                      Total: {booking.totalPrice} ETH ({booking.nights} night
                      {booking.nights === 1 ? '' : 's'})
                    </p>
                    <p>
                      Status:{' '}
                      <span className="font-semibold text-slate-800">
                        {booking.cancelled ? 'Cancelled' : booking.checked ? 'Checked In' : 'Booked'}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onCheckIn(booking)}
                      disabled={!canCheckIn}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        canCheckIn
                          ? 'bg-[#00773d] text-white hover:brightness-110'
                          : 'cursor-not-allowed bg-slate-200 text-slate-500'
                      }`}
                    >
                      Check In
                    </button>
                    <button
                      onClick={() => setRefundTarget(booking)}
                      disabled={!canRefund}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        canRefund
                          ? 'bg-slate-900 text-white hover:brightness-110'
                          : 'cursor-not-allowed bg-slate-200 text-slate-500'
                      }`}
                    >
                      Cancel & Refund
                    </button>
                    <Link
                      href={`/room/${booking.aid}`}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#00773d] hover:text-[#00773d]"
                    >
                      View Property
                    </Link>
                  </div>

                  {canReview && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">Leave a review</p>
                      <textarea
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-slate-300 p-2 text-sm outline-none focus:border-[#00773d]"
                        value={reviewText[booking.aid] || ''}
                        onChange={(e) =>
                          setReviewText((prev) => ({ ...prev, [booking.aid]: e.target.value }))
                        }
                        placeholder="Share your stay experience..."
                      />
                      <button
                        onClick={() => handleReviewSubmit(booking)}
                        disabled={reviewing[booking.aid]}
                        className="mt-2 rounded-full bg-[#00773d] px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                      >
                        {reviewing[booking.aid] ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Modal
        isOpen={Boolean(refundTarget)}
        onRequestClose={() => setRefundTarget(null)}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            width: 'min(90vw, 520px)',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
          },
        }}
      >
        <h2 className="text-lg font-semibold text-slate-900">Cancel & Refund</h2>
        <p className="mt-2 text-sm text-slate-600">
          You will receive your total booking price back. The security deposit fee will be forfeited.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setRefundTarget(null)}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Keep Booking
          </button>
          <button
            onClick={confirmRefund}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Confirm Refund
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default BookingPage
