import React, { useEffect, useState } from 'react'
import { getApartments } from '@/services/blockchain'

function CountryList({ setSelectedLocation, setIsLocationDropdownOpen }) {
  const [apartments, setApartments] = useState([])

  useEffect(() => {
    const fetchApartments = async () => {
      try {
        const fetchedApartments = await getApartments()
        setApartments(fetchedApartments.map((apartment) => apartment.location))
      } catch (error) {
        console.error('Error fetching apartments:', error)
      }
    }

    fetchApartments()
  }, [])

  const handleAddressClick = (address) => {
    setSelectedLocation(address)
    setIsLocationDropdownOpen(false)
  }

  return (
    <div className="z-50">
      <div>
        {apartments.map((location, index) => (
          <div
            className="bg-white flex flex-col gap-2 text-black text-md font-semibold"
            key={index}
            onClick={() => handleAddressClick(location)}
          >
            <div className="p-4 hover:bg-slate-300 cursor-pointer">{location}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CountryList
