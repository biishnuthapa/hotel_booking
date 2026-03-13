import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { globalActions } from '@/store/globalSlices'
import { useDispatch, useSelector } from 'react-redux'
import {
  ImageGrid,
  Description,
  Calendar,
  Actions,
  Review,
  AddReview,
  Features,
} from '@/components'

import {
  getReviews,
  getApartment,
  getBookings,
  getSecurityFee,
  getQualifiedReviewers,
} from '@/services/blockchain'
import { useAccount } from 'wagmi'
import CustomGoogleMap from '../../components/Map/CustomGoogleMap.jsx'
import RoomList from '../../components/RoomList.jsx'

export default function Room({
  apartmentData,
  timestampsData,
  reviewsData,
  securityFee,
  qualifiedReviewers,
}) {
  const router = useRouter()
  const { roomId } = router.query
  const dispatch = useDispatch()
  const { address } = useAccount()

  const { setApartment, setTimestamps, setReviewModal, setReviews, setSecurityFee } = globalActions
  const { apartment, timestamps, reviews } = useSelector((states) => states.globalStates)

  useEffect(() => {
    dispatch(setApartment(apartmentData))
    dispatch(setTimestamps(timestampsData))
    dispatch(setReviews(reviewsData))
    dispatch(setSecurityFee(securityFee))
  }, [
    dispatch,
    setApartment,
    apartmentData,
    setTimestamps,
    timestampsData,
    setReviews,
    reviewsData,
    setSecurityFee,
    securityFee,
  ])

  const handleReviewOpen = () => {
    dispatch(setReviewModal('scale-100'))
  }

  const normalizedReviewers = (qualifiedReviewers || []).map((reviewer) => reviewer?.toLowerCase())
  const canReview = !!address && normalizedReviewers.includes(address.toLowerCase())

  const center = {
    lat: Number.parseFloat(apartment?.latitude) || 0,
    lng: Number.parseFloat(apartment?.longitude) || 0,
  }

  return (
    <>
      <Head>
        <title>Room | {apartment?.name}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold capitalize text-slate-900">{apartment?.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>{apartment?.rooms} {apartment?.rooms == 1 ? 'room' : 'rooms'}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{apartment?.location}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="font-semibold text-[#00773d]">{apartment?.price} ETH / night</span>
          </div>
        </div>
        <ImageGrid
          first={apartment?.images[0]}
          second={apartment?.images[1]}
          third={apartment?.images[2]}
          forth={apartment?.images[3]}
          fifth={apartment?.images[4]}
        />
        <Features />
        <Description apartment={apartment} />
        <Calendar apartment={apartment} timestamps={timestamps} />
        <RoomList apartmentId={apartment?.id || roomId} apartmentOwner={apartment?.owner} />
        <Actions apartment={apartment} />
        <CustomGoogleMap center={center} zoom={11} apiKey={process.env.NEXT_PUBLIC_API_KEY} />
        <div className="space-y-4">
          <div className="flex justify-start items-center space-x-2">
            <h1 className="text-xl font-semibold text-slate-900">Reviews</h1>
            {canReview && (
              <button
                className="cursor-pointer text-sm font-semibold text-[#00773d] hover:underline"
                onClick={handleReviewOpen}
              >
                Drop your review
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {reviews.map((review, i) => (
              <Review key={i} review={review} />
            ))}
            {reviews.length < 1 && (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-600">
                No reviews yet.
              </p>
            )}
          </div>
        </div>
      </div>
      <AddReview roomId={roomId} />
    </>
  )
}

export const getServerSideProps = async (context) => {
  const { roomId } = context.query

  try {
    const apartmentData = await getApartment(roomId)
    const bookingsData = await getBookings(roomId)
    const timestampsData = bookingsData
      .filter((booking) => !booking.cancelled)
      .flatMap((booking) => (booking.dates || []).map((d) => Number(d)))
    const qualifiedReviewers = await getQualifiedReviewers(roomId)
    const reviewsData = await getReviews(roomId)
    const securityFee = await getSecurityFee()

    return {
      props: {
        apartmentData: JSON.parse(JSON.stringify(apartmentData)),
        timestampsData: JSON.parse(JSON.stringify(timestampsData)),
        reviewsData: JSON.parse(JSON.stringify(reviewsData)),
        qualifiedReviewers: JSON.parse(JSON.stringify(qualifiedReviewers)),
        securityFee: JSON.parse(JSON.stringify(securityFee)),
      },
    }
  } catch (error) {
    console.error('Failed to load apartment page data:', error?.reason || error?.message || error)
    return { notFound: true }
  }
}
