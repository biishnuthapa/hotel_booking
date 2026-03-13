import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { getMyBookings } from '@/services/blockchain'
import { formatDate } from '@/utils/helper'

const BookingPage = () => {
  const { address } = useAccount()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-3xl font-semibold text-slate-900">My Bookings</h1>

      {loading && <p className="text-sm text-slate-500">Loading bookings...</p>}

      {!loading && bookings.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
          No bookings found for this wallet.
        </p>
      )}

      <div className="grid gap-3">
        {bookings.map((booking) => (
          <Link
            key={`${booking.aid}-${booking.id}-${booking.timestamp}`}
            href={`/room/${booking.aid}`}
            className="grid gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#00773d]/40"
          >
            <p className="font-semibold text-slate-900">{booking.apartmentName}</p>
            <p className="text-sm text-slate-500">{booking.apartmentLocation}</p>
            <p className="text-sm text-slate-600">Room Type: {booking.roomTypeName || `#${booking.roomTypeIndex}`}</p>
            <p className="text-sm text-slate-600">
              Dates: {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
            </p>
            <p className="text-sm text-slate-600">
              Price: {booking.totalPrice} ETH ({booking.nights} night{booking.nights === 1 ? '' : 's'} at{' '}
              {booking.pricePerNight} ETH)
            </p>
            <p className="text-sm">
              Status:{' '}
              <span className="font-semibold text-slate-800">
                {booking.cancelled ? 'Cancelled' : booking.checked ? 'Checked In' : 'Booked'}
              </span>
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default BookingPage
