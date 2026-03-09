import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { Card } from '@/components'

function SearchPage() {
  const router = useRouter()
  const [apartments, setApartments] = useState([])

  useEffect(() => {
    if (!router.query.filteredApartments) return
    try {
      const parsed = JSON.parse(router.query.filteredApartments)
      setApartments(Array.isArray(parsed) ? parsed : [])
    } catch (error) {
      console.error('Failed to parse search results:', error)
      setApartments([])
    }
  }, [router.query.filteredApartments])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-semibold text-slate-900">Search Results</h1>
      {apartments.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {apartments.map((apartment) => (
            <Card key={apartment.id} appartment={apartment} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
          No hotels available for the selected location.
        </p>
      )}
    </main>
  )
}

export default SearchPage
