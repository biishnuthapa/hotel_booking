import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { globalActions } from '@/store/globalSlices'
import { useDispatch, useSelector } from 'react-redux'
import {
  Title,
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
  getSecurityFee,
  getQualifiedReviewers,
} from '@/services/blockchain'
import { useAccount } from 'wagmi'
import CustomGoogleMap from '../../components/Map/CustomGoogleMap.jsx'
import RoomList from '../../components/RoomList.jsx'
import Amenities from '@/components/Amenities/Amenities.jsx'

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

  const center = {
    lat: parseFloat(apartment?.latitude), // Use fetched latitude
    lng: parseFloat(apartment?.longitude), // Use fetched longitude
  }

  return (
    <>
      <Head>
        <title>Room | {apartment?.name}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="py-8 px-10 sm:px-20 md:px-32 space-y-8">
        <Title apartment={apartment} />
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
        <RoomList apartmentId={roomId} />
        <Actions apartment={apartment} />
        <Amenities/>
        <CustomGoogleMap
          center={center} // Pass center coordinates as a prop
          zoom={11} // Pass zoom level as a prop
          apiKey={process.env.NEXT_PUBLIC_API_KEY} // Pass your API key as a prop
        />
        <div className="flex flex-col justify-between flex-wrap space-y-2">
          <div className="flex justify-start items-center space-x-2">
            <h1 className="text-xl font-semibold">Guest Reviews</h1>
            {qualifiedReviewers?.includes(address) && (
              <button
                className="cursor-pointer text-[#00773d] hover:text-[#00773d]"
                onClick={handleReviewOpen}
              >
                Drop your review
              </button>
            )}
          </div>
          <div>
            {reviews.map((review, i) => (
              <Review key={i} review={review} />
            ))}
            {reviews.length < 1 && 'No reviews yet!'}
          </div>
        </div>
      </div>
      <AddReview roomId={roomId} />
    </>
  )
}

export const getServerSideProps = async (context) => {
  const { roomId } = context.query
  const apartmentData = await getApartment(roomId)
  const qualifiedReviewers = await getQualifiedReviewers(roomId)
  const reviewsData = await getReviews(roomId)
  const securityFee = await getSecurityFee()

  return {
    props: {
      apartmentData: JSON.parse(JSON.stringify(apartmentData)),
      reviewsData: JSON.parse(JSON.stringify(reviewsData)),
      qualifiedReviewers: JSON.parse(JSON.stringify(qualifiedReviewers)),
      securityFee: JSON.parse(JSON.stringify(securityFee)),
    },
  }
}
