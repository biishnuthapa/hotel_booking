import moment from 'moment'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { useSelector } from 'react-redux'
import DatePicker from 'react-datepicker'
import { bookApartment, getRooms, getChainNowSeconds } from '@/services/blockchain'
import { toMillis } from '@/utils/helper'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const Calendar = ({ apartment, timestamps }) => {
  const [checkInDate, setCheckInDate] = useState(null)
  const [checkOutDate, setCheckOutDate] = useState(null)
  const [totalDays, setTotalDays] = useState(0)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [roomList, setRoomList] = useState([])
  const [chainNowSec, setChainNowSec] = useState(null)

  const { securityFee } = useSelector((states) => states.globalStates)
  const excludedDates = (timestamps || []).map((ts) => new Date(toMillis(ts)))

  useEffect(() => {
    const loadCalendarData = async () => {
      try {
        const [roomData, nowSec] = await Promise.all([
          apartment?.id ? getRooms(apartment.id) : Promise.resolve([]),
          getChainNowSeconds(),
        ])
        setRoomList(roomData)
        setChainNowSec(nowSec)
      } catch (error) {
        console.error('Error preparing booking calendar:', error)
      }
    }

    loadCalendarData()
  }, [apartment?.id])

  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const days = moment(checkOutDate).startOf('day').diff(moment(checkInDate).startOf('day'), 'days')
      setTotalDays(Math.max(days, 0))
    } else {
      setTotalDays(0)
    }
  }, [checkInDate, checkOutDate])

  const minCheckInDate = useMemo(() => {
    if (!chainNowSec) return new Date(Date.now() + 24 * 60 * 60 * 1000)
    return new Date((chainNowSec + 60) * 1000)
  }, [chainNowSec])

  const minCheckOutDate = useMemo(() => {
    if (checkInDate) return moment(checkInDate).add(1, 'day').toDate()
    return moment(minCheckInDate).add(1, 'day').toDate()
  }, [checkInDate, minCheckInDate])

  const nightlyPrice = Number(apartment?.price || 0)
  const feePercent = Number(securityFee || 0)
  const subtotal = nightlyPrice * totalDays
  const feeAmount = subtotal * (feePercent / 100)
  const totalAmount = subtotal + feeAmount

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!checkInDate || !checkOutDate) return

    const start = moment(checkInDate).startOf('day')
    const end = moment(checkOutDate).startOf('day')
    const timestampArray = []

    while (start.isBefore(end)) {
      timestampArray.push(start.unix())
      start.add(1, 'day')
    }

    if (timestampArray.length === 0) {
      toast.error('Please select a valid check-in/check-out range.')
      return
    }

    if (chainNowSec && timestampArray.some((date) => date <= chainNowSec)) {
      toast.error(
        'Selected dates are behind the current blockchain clock. Restart local node or pick later dates.'
      )
      return
    }

    const params = {
      aid: apartment?.id,
      timestamps: timestampArray,
      nightlyPrice: apartment?.price,
      feePercent: securityFee,
      selectedRoom,
    }

    toast.promise(
      new Promise((resolve, reject) => {
        bookApartment(params)
          .then(async () => {
            resetForm()
            resolve()
          })
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Booking is successful.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  const resetForm = () => {
    setCheckInDate(null)
    setCheckOutDate(null)
    setTotalDays(0)
    setSelectedRoom('')
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Reserve Your Stay</h2>
        <p className="text-sm text-slate-500">
          Chain time: {chainNowSec ? new Date(chainNowSec * 1000).toLocaleString() : 'Loading...'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Check-in</span>
            <DatePicker
              id="checkInDate"
              selected={checkInDate}
              autoComplete="off"
              onChange={(date) => setCheckInDate(date)}
              placeholderText="YYYY-MM-DD"
              dateFormat="yyyy-MM-dd"
              minDate={minCheckInDate}
              excludeDates={excludedDates}
              required
              className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-[#00773d]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Check-out</span>
            <DatePicker
              id="checkOutDate"
              selected={checkOutDate}
              autoComplete="off"
              onChange={(date) => setCheckOutDate(date)}
              placeholderText="YYYY-MM-DD"
              dateFormat="yyyy-MM-dd"
              minDate={minCheckOutDate}
              excludeDates={excludedDates}
              required
              className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-[#00773d]"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Room Type (optional)</span>
          <select
            id="roomName"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-[#00773d]"
          >
            <option value="">Any available room</option>
            {roomList.map((room) => (
              <option key={room.id} value={room.name}>
                {room.name} - {room.capacity} guest(s) - {room.price} ETH
              </option>
            ))}
          </select>
        </label>

        {roomList.length === 0 && (
          <p className="text-sm text-slate-500">
            No room types configured yet. Booking still works using apartment-level pricing.
          </p>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>Nightly Price: {nightlyPrice || 0} ETH</p>
          <p>Total Nights: {totalDays}</p>
          <p>Security Fee: {feePercent}% ({feeAmount.toFixed(4)} ETH)</p>
          <p className="mt-1 font-semibold text-slate-900">Estimated Total: {totalAmount.toFixed(4)} ETH</p>
        </div>

        <button className="rounded-xl bg-[#00773d] p-3 font-semibold text-white transition hover:brightness-110">
          Book Now
        </button>

        <Link href={`/room/bookings/${apartment?.id}`} className="text-sm font-medium text-[#00773d]">
          Open booking list and check-in
        </Link>
      </form>
    </div>
  )
}

export default Calendar
