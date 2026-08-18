import moment from 'moment'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-toastify'
import { useSelector } from 'react-redux'
import DatePicker from 'react-datepicker'
import { bookApartment, getRooms, getChainNowSeconds, getBookings } from '@/services/blockchain'
import { toMillis } from '@/utils/helper'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const ACTIVE_STATUSES = [0, 2] // Booked or CheckedIn

const Calendar = ({ apartment }) => {
  const [checkInDate, setCheckInDate] = useState(null)
  const [checkOutDate, setCheckOutDate] = useState(null)
  const [totalDays, setTotalDays] = useState(0)
  const [nightlyPrice, setNightlyPrice] = useState(0)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [roomsRequested, setRoomsRequested] = useState(1)
  const [bookings, setBookings] = useState([])
  const [roomList, setRoomList] = useState([])
  const [chainNowSec, setChainNowSec] = useState(null)

  const { securityFee } = useSelector((states) => states.globalStates)
  const excludedDates = useMemo(() => {
    if (!selectedRoom) return []
    const room = roomList.find((r) => String(r.id) === String(selectedRoom))
    if (!room) return []
    const capacity = Number(room.capacity) || 0
    const perDateCount = new Map()

    bookings.forEach((booking) => {
      if (String(booking.roomTypeIndex) !== String(selectedRoom)) return
      if (!ACTIVE_STATUSES.includes(Number(booking.status))) return
      const count = Number(booking.roomsBooked || 1)
      for (const date of booking.dates || []) {
        const key = Number(date)
        perDateCount.set(key, (perDateCount.get(key) || 0) + count)
      }
    })

    const blocked = []
    for (const [date, count] of perDateCount.entries()) {
      if (count + Number(roomsRequested || 1) > capacity) {
        blocked.push(new Date(toMillis(date)))
      }
    }
    return blocked
  }, [bookings, roomsRequested, roomList, selectedRoom])

  useEffect(() => {
    const loadCalendarData = async () => {
      try {
        const [roomData, nowSec, bookingData] = await Promise.all([
          apartment?.id ? getRooms(apartment.id) : Promise.resolve([]),
          getChainNowSeconds(),
          apartment?.id ? getBookings(apartment.id) : Promise.resolve([]),
        ])
        setRoomList(roomData)
        setBookings(bookingData)
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
    // Bookings are day-granular: the contract stores each night as that day's
    // start-of-day timestamp. Requiring the check-in to be the NEXT day
    // guarantees start-of-day > chain-now regardless of timezone, so a user can
    // never pick a "today" that is already behind the on-chain clock.
    const base = chainNowSec ? chainNowSec * 1000 : Date.now()
    return moment(base).add(1, 'day').startOf('day').toDate()
  }, [chainNowSec])

  const minCheckOutDate = useMemo(() => {
    if (checkInDate) return moment(checkInDate).add(1, 'day').toDate()
    return moment(minCheckInDate).add(1, 'day').toDate()
  }, [checkInDate, minCheckInDate])

  const feePercent = Number(securityFee || 0)
  const subtotal = nightlyPrice * totalDays
  const feeAmount = subtotal * (feePercent / 100)
  const totalAmount = subtotal + feeAmount

  const handleRoomChange = (e) => {
    const roomIndex = e.target.value
    setSelectedRoom(roomIndex)
    setRoomsRequested(1)

    if (roomIndex !== '') {
      const room = roomList.find((r) => String(r.id) === roomIndex)
      setNightlyPrice(room?.price || 0)
    } else {
      setNightlyPrice(0)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (selectedRoom === '') {
      toast.error('Please choose a room type before booking.')
      return
    }
    if (!checkInDate || !checkOutDate) return
    if (!nightlyPrice || Number(nightlyPrice) <= 0) {
      toast.error('Please choose a room type with a nightly price before booking.')
      return
    }
    if (Number(roomsRequested) < 1) {
      toast.error('Please request at least one room.')
      return
    }

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
      roomTypeIndex: Number(selectedRoom),
      rooms: Number(roomsRequested),
      nightlyPrice: nightlyPrice,
      feePercent: securityFee,
    }

    toast.promise(
      new Promise((resolve, reject) => {
        bookApartment(params)
          .then(async () => {
            resetForm()
            if (apartment?.id) {
              try {
                const latestBookings = await getBookings(apartment.id)
                setBookings(latestBookings)
              } catch (err) {
                console.warn('Could not refresh bookings after booking:', err)
              }
            }
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
    setNightlyPrice(0)
    setRoomsRequested(1)
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
            <span className="mb-1 block text-sm font-medium text-slate-700">Room Type</span>
            <select
              id="roomName"
              value={selectedRoom}
              onChange={handleRoomChange}
              className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-[#00773d]"
              required
            >
              <option value="">Select a room type first</option>
              {roomList.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.capacity} rooms available · {room.price} ETH/night
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Rooms Needed</span>
            <input
              type="number"
              min={1}
              max={selectedRoom ? roomList.find((r) => String(r.id) === String(selectedRoom))?.capacity || 1 : 1}
              value={roomsRequested}
              onChange={(e) => setRoomsRequested(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-[#00773d]"
              required
            />
          </label>
        </div>

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
              disabled={!selectedRoom}
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
              disabled={!selectedRoom}
              className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-[#00773d]"
            />
          </label>
        </div>

        {roomList.length === 0 && (
          <p className="text-sm text-slate-500">
            No room types configured yet. Ask the owner to add a room type to enable booking.
          </p>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>Nightly Price: {nightlyPrice || 0} ETH</p>
          <p>Total Nights: {totalDays}</p>
          <p>Security Fee: {feePercent}% ({feeAmount.toFixed(4)} ETH)</p>
          <p className="mt-1 font-semibold text-slate-900">Estimated Total: {totalAmount.toFixed(4)} ETH</p>
        </div>

        <button
          className="rounded-xl bg-[#00773d] p-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={roomList.length === 0}
        >
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
