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
      <ul>
        {apartments.map((apartment, index) => (
          <li key={index}>
            <Link href={`/room/${apartment[0]}`}>
              <ApartmentCard apartment={apartment} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SearchPage
