import moment from 'moment'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useSelector } from 'react-redux'
import DatePicker from 'react-datepicker'
import { bookApartment, getRooms } from '@/services/blockchain'

const Calendar = ({ apartment, timestamps }) => {
  const [checkInDate, setCheckInDate] = useState(null)
  const [checkOutDate, setCheckOutDate] = useState(null)
  const [totalDays, setTotalDays] = useState(0)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [roomList, setRoomList] = useState([])
  const [breakfastIncluded, setBreakfastIncluded] = useState(false)

  const { securityFee } = useSelector((states) => states.globalStates)

  useEffect(() => {
    const fetchRoomsData = async () => {
      try {
        const roomData = await getRooms(apartment?.id)
        setRoomList(roomData)
      } catch (error) {
        console.error('Error fetching rooms:', error)
      }
    }

    fetchRoomsData()
  }, [apartment?.id])

  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const days = moment(checkOutDate).diff(moment(checkInDate), 'days')
      setTotalDays(days)
    }
  }, [checkInDate, checkOutDate])

  const handleDateChange = (date, type) => {
    if (type === 'checkin') {
      setCheckInDate(date)
    } else if (type === 'checkout') {
      setCheckOutDate(date)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!checkInDate || !checkOutDate || !selectedRoom) return

    const start = moment(checkInDate)
    const end = moment(checkOutDate)
    const timestampArray = []

    while (start < end) {
      timestampArray.push(start.valueOf())
      start.add(1, 'days')
    }

    const params = {
      aid: apartment?.id,
      timestamps: timestampArray,
      amount:
        apartment?.price * timestampArray.length +
        (apartment?.price * timestampArray.length * securityFee) / 100,
      room: selectedRoom,
      breakfastIncluded, // Include breakfast in the params
    }

    toast.promise(
      new Promise((resolve, reject) => {
        bookApartment(params)
          .then(async () => {
            resetForm()
            resolve()
          })
          .catch(() => reject())
      }),
      {
        pending: 'Approve transaction...',
        success: 'Apartment booked successfully 👌',
        error: 'Encountered error 🤯',
      }
    )
  }

  const resetForm = () => {
    setCheckInDate(null)
    setCheckOutDate(null)
    setTotalDays(0)
    setSelectedRoom('')
    setBreakfastIncluded(false) // Reset breakfast inclusion state
  }

  return (
    <div className="flex">
      <form
        onSubmit={handleSubmit}
        className="sm:w-[25rem] border-[0.1px] p-6
        border-gray-400 rounded-lg shadow-lg flex flex-col
        space-y-4"
      >
        <div className="flex justify-between">
          <div className="flex justify-center items-center">
            {/* <FaEthereum className="text-lg text-gray-500" /> */}
            <span className="text-lg text-gray-500">
              {/* {apartment?.price} <small>per night</small> */}
               <small>$285 per night</small>
            </span>
          </div>
          <div className="text-gray-500">Total Days: {totalDays}</div>
        </div>
        <DatePicker
          id="checkInDate"
          selected={checkInDate}
          autoComplete="off"
          onChange={(date) => handleDateChange(date, 'checkin')}
          placeholderText="YYYY-MM-DD (Check In)"
          dateFormat="yyyy-MM-dd"
          minDate={new Date()}
          excludeDates={timestamps}
          required
          className="rounded-lg w-full border border-gray-400 p-2"
        />
        <DatePicker
          id="checkOutDate"
          selected={checkOutDate}
          autoComplete="off"
          onChange={(date) => handleDateChange(date, 'checkout')}
          placeholderText="YYYY-MM-DD (Check out)"
          dateFormat="yyyy-MM-dd"
          minDate={moment(checkInDate).add(1, 'day').toDate()}
          excludeDates={timestamps}
          required
          className="rounded-lg w-full border border-gray-400 p-2"
        />
        <select
          id="roomName"
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          className="rounded-lg w-full border border-gray-400 p-2"
          required
        >
          <option value="">Select Room</option>
          {roomList.map((room) => (
            <option key={room.id} value={room.name}>
              {room.name}
            </option>
          ))}
        </select>
        <div className="flex items-center">
          <label htmlFor="breakfastIncluded" className="mr-2">
            Breakfast Included:
          </label>
          <select
            id="breakfastIncluded"
            value={breakfastIncluded}
            onChange={(e) => setBreakfastIncluded(e.target.value === 'true')}
            className="rounded-lg border border-gray-400 p-2"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <button
          className="p-2 border-none bg-gradient-to-l from-[#00773d]
          to-[#00773d] text-white w-full rounded-md focus:outline-none
          focus:ring-0"
        >
          Book
        </button>
        <Link href={`/room/bookings/${apartment?.id}`} className="text-[#00773d]">
          Check your bookings
        </Link>
      </form>
    </div>
  )
}

export default Calendar
