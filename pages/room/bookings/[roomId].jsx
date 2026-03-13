import { useEffect, useMemo } from 'react'
import { Booking } from '@/components'
import { useRouter } from 'next/router'
import { globalActions } from '@/store/globalSlices'
import { useDispatch, useSelector } from 'react-redux'
import { getBookings, getApartment, getRooms } from '@/services/blockchain'

const Bookings = ({ apartmentData, bookingsData }) => {
  const router = useRouter()
  const { roomId } = router.query

  const dispatch = useDispatch()

  const { setApartment, setBookings } = globalActions
  const { apartment, bookings } = useSelector((states) => states.globalStates)

  const currentBookings = useMemo(
    () => [...(bookings || [])].sort((a, b) => Number(b.checkInDate) - Number(a.checkInDate)),
    [bookings]
  )

  useEffect(() => {
    dispatch(setApartment(apartmentData))
    dispatch(setBookings(bookingsData))
  }, [dispatch, setApartment, apartmentData, setBookings, bookingsData])

  return (
    <div className="mx-auto mt-8 w-full max-w-4xl px-4">
      <h1 className="mb-4 text-center text-3xl font-bold text-slate-900">Bookings</h1>
      {currentBookings.length < 1 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
          No bookings for this apartment yet.
        </div>
      )}

      {currentBookings.map((booking, i) => (
        <Booking
          key={i}
          id={roomId}
          booking={booking}
          apartment={apartment}
        />
      ))}
    </div>
  )
}

export default Bookings

export const getServerSideProps = async (context) => {
  const { roomId } = context.query

  try {
    const apartmentData = await getApartment(roomId)
    const [bookingsData, roomsData] = await Promise.all([getBookings(roomId), getRooms(roomId)])
    const roomNameByIndex = new Map(roomsData.map((room) => [Number(room.id), room.name]))
    const bookingsDataWithNames = bookingsData.map((booking) => ({
      ...booking,
      roomTypeName: roomNameByIndex.get(Number(booking.roomTypeIndex)) || 'Room Type',
    }))

    return {
      props: {
        apartmentData: JSON.parse(JSON.stringify(apartmentData)),
        bookingsData: JSON.parse(JSON.stringify(bookingsDataWithNames)),
      },
    }
  } catch (error) {
    console.error('Failed to load bookings page data:', error?.reason || error?.message || error)
    return { notFound: true }
  }
}
