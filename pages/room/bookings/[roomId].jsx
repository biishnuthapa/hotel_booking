import { useEffect } from 'react'
import { Booking } from '@/components'
import { useRouter } from 'next/router'
import { globalActions } from '@/store/globalSlices'
import { useDispatch, useSelector } from 'react-redux'
import { getBookings, getApartment } from '@/services/blockchain'

const Bookings = ({ apartmentData, bookingsData }) => {
  const router = useRouter()
  const { roomId } = router.query

  const dispatch = useDispatch()

  const { setApartment, setBookings } = globalActions
  const { apartment, bookings } = useSelector((states) => states.globalStates)

  const currentBookings = bookings || []

  const newBookings = currentBookings.filter(
    (booking, index, self) => index === self.findIndex((b) => b.timestamp === booking.timestamp)
  )

  const getMaxDateForTimestamp = (timestamp) => {
    const bookingsWithSameTimestamp = currentBookings.filter((b) => b.timestamp === timestamp)
    const maxDateBooking = bookingsWithSameTimestamp.reduce((prev, current) =>
      Number(prev.date) > Number(current.date) ? prev : current
    )

    // Return checkout day (+1 day) as seconds
    const oneDayInSeconds = 24 * 60 * 60
    return Number(maxDateBooking.date) + oneDayInSeconds
  }
  useEffect(() => {
    dispatch(setApartment(apartmentData))
    dispatch(setBookings(bookingsData))
  }, [dispatch, setApartment, apartmentData, setBookings, bookingsData])

  return (
    <div className="mx-auto mt-8 w-full max-w-4xl px-4">
      <h1 className="mb-4 text-center text-3xl font-bold text-slate-900">Bookings</h1>
      {newBookings.length < 1 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
          No bookings for this apartment yet.
        </div>
      )}

      {newBookings.map((booking, i) => (
        <Booking
          key={i}
          id={roomId}
          booking={booking}
          apartment={apartment}
          maxDateOut={getMaxDateForTimestamp(booking.timestamp)}
        />
      ))}
    </div>
  )
}

export default Bookings

export const getServerSideProps = async (context) => {
  const { roomId } = context.query
  const apartmentData = await getApartment(roomId)
  const bookingsData = await getBookings(roomId)

  return {
    props: {
      apartmentData: JSON.parse(JSON.stringify(apartmentData)),
      bookingsData: JSON.parse(JSON.stringify(bookingsData)),
    },
  }
}
