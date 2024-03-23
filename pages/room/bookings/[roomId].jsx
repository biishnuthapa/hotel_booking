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

  const newBookings=bookings?.filter((booking, index, self) =>
  index === self.findIndex((b) => b.timestamp === booking.timestamp)
);

const getMaxDateForTimestamp = (timestamp) => {
  const bookingsWithSameTimestamp = bookings.filter(
    (b) => b.timestamp === timestamp
  )
  const maxDateBooking = bookingsWithSameTimestamp.reduce((prev, current) =>
    new Date(prev.date) > new Date(current.date) ? prev : current
  )

  // Add one day to the max date
  const maxDate = new Date(maxDateBooking.date)
  maxDate.setDate(maxDate.getDate() + 1)

  return maxDate.getTime() // Return the timestamp of the modified max date
}


console.log("Booking",bookings)

  useEffect(() => {
    dispatch(setApartment(apartmentData))
    dispatch(setBookings(bookingsData))
  }, [dispatch, setApartment, apartmentData, setBookings, bookingsData])
   return (
    <div className="w-full sm:w-3/5 mx-auto mt-8">
      <h1 className="text-center text-3xl text-black font-bold">Bookings</h1>
      {newBookings.length < 1 && <div>No bookings for this apartment yet</div>}

      {newBookings.map((booking, i) => (
        <Booking key={i} id={roomId} booking={booking} apartment={apartment} maxDateOut={getMaxDateForTimestamp(booking.timestamp)}/>
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
