import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Modal from 'react-modal'
import { toast } from 'react-toastify'
import { useAccount } from 'wagmi'
import CreateRoomType from '@/components/CreateRoomType'
import {
  checkoutGuest,
  claimNoShowFunds,
  getApartments,
  getBookings,
  getChainNowSeconds,
  getRevenueEvents,
  getRooms,
  getSecurityFee,
  getTaxPercent,
} from '@/services/blockchain'
import { formatDate } from '@/utils/helper'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const NFTPage = () => {
  const { address } = useAccount()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(false)
  const [chainNowSec, setChainNowSec] = useState(null)
  const [activeRoomModal, setActiveRoomModal] = useState(null)
  const [ownerEarnings, setOwnerEarnings] = useState(0)

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
    const loadProperties = async () => {
      if (!address) {
        setProperties([])
        return
      }

      try {
        setLoading(true)
        const apartments = await getApartments()
        const owned = apartments.filter(
          (apartment) => apartment.owner?.toLowerCase() === address.toLowerCase()
        )

        const hydrated = await Promise.all(
          owned.map(async (apartment) => {
            let roomTypes = []
            let bookings = []
            try {
              roomTypes = await getRooms(apartment.id)
            } catch (error) {
              console.error(`Failed to load rooms for apartment ${apartment.id}:`, error)
            }
            try {
              bookings = await getBookings(apartment.id)
            } catch (error) {
              console.error(`Failed to load bookings for apartment ${apartment.id}:`, error)
            }
            return { ...apartment, roomTypes, bookings }
          })
        )

        setProperties(hydrated)
      } catch (error) {
        console.error('Failed to load properties:', error)
        setProperties([])
      } finally {
        setLoading(false)
      }
    }

    loadProperties()
  }, [address])

  useEffect(() => {
    const loadOwnerRevenue = async () => {
      if (!address || properties.length === 0) {
        setOwnerEarnings(0)
        return
      }

      try {
        const [events, taxPercent, securityFee] = await Promise.all([
          getRevenueEvents(0),
          getTaxPercent(),
          getSecurityFee(),
        ])

        const bookingByKey = new Map()
        properties.forEach((property) => {
          property.bookings.forEach((booking) => {
            bookingByKey.set(`${property.id}-${booking.id}`, booking)
          })
        })

        const total = events.reduce((sum, event) => {
          const booking = bookingByKey.get(`${event.aid}-${event.bookingId}`)
          if (!booking) return sum
          const totalPrice = Number(booking.totalPrice || 0)
          if (!Number.isFinite(totalPrice) || totalPrice <= 0) return sum

          if (event.type === 'checked_in') {
            return sum + (totalPrice * (100 - taxPercent)) / 100
          }
          if (event.type === 'claimed') {
            const fee = (totalPrice * securityFee) / 100
            return sum + (totalPrice * (100 - taxPercent)) / 100 + fee
          }
          if (event.type === 'refunded') {
            const fee = (totalPrice * securityFee) / 100
            return sum + fee / 2
          }
          return sum
        }, 0)

        setOwnerEarnings(total)
      } catch (error) {
        console.error('Failed to compute owner earnings:', error)
        setOwnerEarnings(0)
      }
    }

    loadOwnerRevenue()
  }, [address, properties])

  const bookingRows = useMemo(
    () =>
      properties.flatMap((property) =>
        property.bookings.map((booking) => ({
          ...booking,
          propertyId: property.id,
          propertyName: property.name,
          propertyLocation: property.location,
        }))
      ),
    [properties]
  )

  const handleCheckout = (booking) => {
    toast.promise(
      new Promise((resolve, reject) => {
        checkoutGuest(booking.propertyId, booking.id)
          .then((tx) => resolve(tx))
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approving checkout...',
        success: 'Guest checked out successfully.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  const handleClaim = (booking) => {
    toast.promise(
      new Promise((resolve, reject) => {
        claimNoShowFunds(booking.propertyId, booking.id)
          .then((tx) => resolve(tx))
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approving claim...',
        success: 'No-show funds claimed.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Property Management</h1>
          <p className="text-sm text-slate-600">Manage listings, room types, and upcoming stays.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/room/add"
            className="rounded-xl bg-[#00773d] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Create Property
          </Link>
          <Link
            href="/MyBookings"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#00773d] hover:text-[#00773d]"
          >
            Go to My Trips
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading your properties...</p>}

      {!loading && properties.length > 0 && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Properties</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{properties.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Bookings</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{bookingRows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Owner Earnings (ETH)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{ownerEarnings.toFixed(4)}</p>
          </div>
        </div>
      )}

      {!loading && properties.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
          You have no properties yet. Create one to start hosting.
        </p>
      )}

      <div className="grid gap-6">
        {properties.map((property) => (
          <div
            key={property.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{property.name}</p>
                <p className="text-sm text-slate-500">{property.location}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/room/${property.id}`}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-[#00773d] hover:text-[#00773d]"
                >
                  View
                </Link>
                <Link
                  href={`/room/edit/${property.id}`}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-[#00773d] hover:text-[#00773d]"
                >
                  Edit
                </Link>
                <button
                  onClick={() => setActiveRoomModal(property.id)}
                  className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:brightness-110"
                >
                  Add Room Type
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
              <div>
                <p className="font-semibold text-slate-800">Rooms</p>
                <p>{property.rooms} total</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Room Types</p>
                <p>{property.roomTypes?.length || 0}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Bookings</p>
                <p>{property.bookings.length}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">Action Center</h2>
        <p className="text-sm text-slate-600">Handle upcoming stays and no-shows.</p>

        <div className="mt-4 grid gap-3">
          {bookingRows.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-600">
              No bookings yet.
            </p>
          )}
          {bookingRows.map((booking) => {
            const checkOutDate = booking.checkOutDate || 0
            const checkInDate = booking.checkInDate || 0
            const canCheckout = booking.status === 2 && chainNowSec && chainNowSec > checkOutDate
            const canClaim = booking.status === 0 && chainNowSec && chainNowSec > checkInDate

            return (
              <div
                key={`${booking.propertyId}-${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {booking.propertyName} · {booking.roomTypeName || `Room #${booking.roomTypeIndex}`}
                  </p>
                  <p className="text-xs text-slate-500">{booking.propertyLocation}</p>
                  <p className="text-xs text-slate-600">
                    {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {booking.status === 2
                      ? 'Checked In'
                      : booking.status === 1
                      ? 'Cancelled'
                      : booking.status === 3
                      ? 'Expired'
                      : 'Booked'}
                  </span>
                  <button
                    onClick={() => handleCheckout(booking)}
                    disabled={!canCheckout}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      canCheckout
                        ? 'bg-[#00773d] text-white hover:brightness-110'
                        : 'cursor-not-allowed bg-slate-200 text-slate-500'
                    }`}
                  >
                    Checkout Guest
                  </button>
                  <button
                    onClick={() => handleClaim(booking)}
                    disabled={!canClaim}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      canClaim
                        ? 'bg-slate-900 text-white hover:brightness-110'
                        : 'cursor-not-allowed bg-slate-200 text-slate-500'
                    }`}
                  >
                    Claim No-Show Funds
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        isOpen={activeRoomModal !== null}
        onRequestClose={() => setActiveRoomModal(null)}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            width: 'min(92vw, 560px)',
            borderRadius: '22px',
            border: '1px solid #e2e8f0',
            padding: 0,
          },
        }}
      >
        {activeRoomModal !== null && (
          <CreateRoomType apartmentId={activeRoomModal} onClose={() => setActiveRoomModal(null)} />
        )}
      </Modal>
    </div>
  )
}

export default NFTPage
