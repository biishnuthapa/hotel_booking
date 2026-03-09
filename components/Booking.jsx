import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { toast } from 'react-toastify'
import Identicon from 'react-identicons'
import { formatDate, toMillis, truncate } from '@/utils/helper'
import { checkInApartment, refundBooking, getChainNowSeconds } from '@/services/blockchain'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const Booking = ({ booking, maxDateOut }) => {
  const router = useRouter()
  const { address } = useAccount()
  const [chainNowSec, setChainNowSec] = useState(null)

  useEffect(() => {
    const loadChainTime = async () => {
      try {
        setChainNowSec(await getChainNowSeconds())
      } catch (error) {
        console.error('Failed to load chain time for check-in state:', error)
      }
    }

    loadChainTime()
  }, [])

  const canCheckInNow = chainNowSec ? booking.date <= chainNowSec : toMillis(booking.date) <= Date.now()

  const handleCheckIn = () => {
    toast.promise(
      new Promise((resolve, reject) => {
        checkInApartment(booking.aid, booking.id)
          .then((tx) => {
            resolve(tx)
            router.push('/MyNFTs')
          })
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Booking confirmed and NFT sent to your wallet.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  const handleRefund = () => {
    toast.promise(
      new Promise((resolve, reject) => {
        refundBooking(booking.aid, booking.id)
          .then(() => resolve())
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Refunded successfully.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  const functions = {
    handleCheckIn,
    handleRefund,
  }

  return (
    <TenantView
      booking={booking}
      functions={functions}
      owner={address}
      maxDateOut={maxDateOut}
      canCheckInNow={canCheckInNow}
    />
  )
}

const TenantView = ({ booking, functions, owner, maxDateOut, canCheckInNow }) => {
  return (
    <div className="my-3 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <Link
        className="flex justify-start items-center
      space-x-2 font-medium"
        href={'/room/' + booking.aid}
      >
        <Identicon
          string={booking.tenant}
          size={30}
          className="rounded-full shadow-gray-500 shadow-sm"
        />
        <div className="flex flex-col">
          <span>
            {formatDate(booking.date)} - {formatDate(maxDateOut)}
          </span>
          <span className="text-gray-500 text-sm">{truncate(booking.tenant, 4, 4, 11)}</span>
        </div>
      </Link>

      {booking.tenant == owner && !booking.checked && !booking.cancelled && (
        <div className="flex space-x-2">
          <button
            className={`rounded-full px-4 py-2 text-sm ${
              canCheckInNow
                ? 'bg-[#00773d] text-white hover:brightness-110'
                : 'cursor-not-allowed bg-slate-200 text-slate-500'
            }`}
            onClick={functions.handleCheckIn}
            disabled={!canCheckInNow}
            title={
              canCheckInNow ? 'Check in and mint your NFT.' : 'Check-in is available on your booking date.'
            }
          >
            Check In
          </button>

          <button
            className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white hover:brightness-110"
            onClick={functions.handleRefund}
          >
            Refund
          </button>
        </div>
      )}

      {booking.tenant == owner && booking.checked && !booking.cancelled && (
        <button
          className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium italic text-emerald-800"
        >
          Checked In
        </button>
      )}

      {booking.tenant != owner && !booking.cancelled && (
        <button
          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium italic text-slate-700"
        >
          Booked
        </button>
      )}

      {booking.cancelled && (
        <button
          className="rounded-full bg-rose-100 px-4 py-2 text-sm font-medium italic text-rose-700"
        >
          Cancelled
        </button>
      )}
    </div>
  )
}

export default Booking
