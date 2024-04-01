import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { ApartmentCard } from '@/components'

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
      <ul>
        <h1 className="text-3xl font-semibold mb-8 mt-6 text-center">Search Results</h1>

        {apartments.map((apartment, index) => (
          <li key={index}>
            <ApartmentCard apartment={apartment} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SearchPage
