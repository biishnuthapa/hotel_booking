import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import ApartmentCard from '@/components/ApartmentCard'

function SearchPage() {
  const router = useRouter()
  const [apartments, setApartments] = useState([])

  useEffect(() => {
    if (router.query.filteredApartments) {
      const filteredApartments = JSON.parse(router.query.filteredApartments)
      setApartments(filteredApartments)
    }
  }, [router.query.filteredApartments])

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-8 mt-6 text-center">Search Results</h1>
      {apartments.length > 0 ? (
        <ul>
          {apartments.map((apartment, index) => (
            <li key={index}>
              <Link href={`/room/${apartment[0]}`}>
                <ApartmentCard apartment={apartment} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center">No hotels available in your location.</p>
      )}
    </div>
  )
}

export default SearchPage
