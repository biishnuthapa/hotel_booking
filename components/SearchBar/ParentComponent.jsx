import React, { useState } from 'react'
import SearchBar from './SearchBar'

function ParentComponent() {
  const [selectedLocation, setSelectedLocation] = useState('')
  const [checkOutDate, setCheckOutDate] = useState(null)
  const [checkInDate, setCheckInDate] = useState(null)
  const [apartments, setApartments] = useState([])
  const [guests, setGuests] = useState({
    adults: 0,
    children: 0,
    infants: 0,
    pets: 0,
  })

  const handleSearch = () => {
    if (selectedLocation && checkOutDate && guests.adults > 0) {
      alert('Performing search...')
    } else {
      alert('Please fill all required fields.')
    }
  }

  return (
    <div>
      <SearchBar
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        checkOutDate={checkOutDate}
        setCheckOutDate={setCheckOutDate}
        checkInDate={checkInDate}
        setCheckInDate={setCheckInDate}
        guests={guests}
        setGuests={setGuests}
        onSearch={handleSearch}
        apartments={apartments}
        setApartments={setApartments}
      />
    </div>
  )
}

export default ParentComponent
