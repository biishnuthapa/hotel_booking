import Image from 'next/image'
import React, { useState, useRef, useEffect } from 'react'
import SearchIcon from '../../public/assets'
import Calendar from '../Calendar'
import AddGuests from './AddGuests'
import CountryList from './CountryList'

function SearchBar() {
  const toggleLocationDropdown = () => {
    setIsLocationDropdownOpen(!isLocationDropdownOpen)
  }

  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState('')

  const [checkOutDate, setCheckOutDate] = useState(null)
  const [isCheckOutCalendarOpen, setIsCheckOutCalendarOpen] = useState(false)

  const [isGuestsDropdownOpen, setIsGuestsDropdownOpen] = useState(false)
  const [guests, setGuests] = useState({
    adults: 0,
    children: 0,
    infants: 0,
    pets: 0,
  })

  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsGuestsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownRef])

  const toggleGuestsDropdown = () => {
    setIsGuestsDropdownOpen(!isGuestsDropdownOpen)
  }

  const guestCountAdd = (category) => {
    setGuests((prevGuests) => ({
      ...prevGuests,
      [category]: prevGuests[category] + 1,
    }))
  }

  const guestCountSub = (category) => {
    setGuests((prevGuests) => ({
      ...prevGuests,
      [category]: Math.max(prevGuests[category] - 1, 0),
    }))
  }

  const totalGuests = guests.adults + guests.children
  const totalPets = guests.pets
  const totalInfants = guests.infants

  let whoText = 'Add guests'

  if (totalGuests > 0) {
    whoText = `${totalGuests} Guest${totalGuests !== 1 ? 's' : ''}`
  }
  if (totalInfants > 0) {
    whoText += `, ${totalInfants} Infant${totalInfants !== 1 ? 's' : ''}`
  }

  if (totalPets > 0) {
    whoText += `, ${totalPets} Pet${totalPets !== 1 ? 's' : ''}`
  }

  return (
    <div className="flex justify-center z-50">
      {' '}
      {/* Ensure the SearchBar stays on top */}
      <div className="bg-transparent border-2 border-[#ccc] rounded-full shadow-lg p-3 mt-[24px] w-fit flex justify-center">
        <div className="flex items-center ">
          <div className="flex flex-col mr-[10px] ml-[20px] border-r-2 border-[#ccc] ">
            <label htmlFor="location" className="mr-[5px]">
              Where
            </label>
            <div className="relative">
              <input
                value={selectedLocation}
                className="w-[300px] border-0 rounded-sm bg-transparent outline-none "
                type="text"
                id="location"
                placeholder="Destination"
                onClick={toggleLocationDropdown}
                autoComplete="off"
              />
              {isLocationDropdownOpen && (
                <div
                  className="dropdown-content absolute bg-white shadow-md rounded-md mt-1 left-0"
                  ref={dropdownRef}
                >
                  <div className="flex flex-col px-4 py-2">
                    <CountryList
                      selectedLocation={selectedLocation}
                      setSelectedLocation={setSelectedLocation}
                      setIsLocationDropdownOpen={setIsLocationDropdownOpen}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col mr-[10px] ml-[20px]  border-r-2 border-[#ccc]">
            <label htmlFor="check-out" className="mr-[5px]">
              Entry and Exit
            </label>
            <div className="relative">
              <input
                type="text"
                className="outline-none bg-transparent"
                value={checkOutDate ? checkOutDate.toString() : ''}
                placeholder="Register"
                onClick={() => setIsCheckOutCalendarOpen(!isCheckOutCalendarOpen)}
                readOnly
              />
              {isCheckOutCalendarOpen && (
                <div className="absolute z-10 bg-white p-4">
                  <Calendar
                    onDateSelected={(date) => {
                      setCheckOutDate(date)
                      setIsCheckOutCalendarOpen(false)
                    }}
                    className="calendar-container"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col mr-[10px] ml-[20px] border-[#ccc] border-r-0">
            <label htmlFor="guests" className="mr-[5px]">
              Who
            </label>
            <div className="relative">
              <input
                className="w-[300px] outline-none bg-transparent"
                type="text"
                id="guests"
                placeholder={whoText}
                onClick={toggleGuestsDropdown}
                readOnly
              />
              {isGuestsDropdownOpen && (
                <div
                  className="dropdown-content absolute bg-white shadow-md rounded-md mt-1 right-0"
                  ref={dropdownRef}
                >
                  <div className="flex flex-col px-4 py-2">
                    <AddGuests
                      guestCount={guests.adults}
                      guestCountAdd={() => guestCountAdd('adults')}
                      guestCountSub={() => guestCountSub('adults')}
                      guestsTitle="Adults"
                      category="adults"
                    />
                    <AddGuests
                      guestCount={guests.children}
                      guestCountAdd={() => guestCountAdd('children')}
                      guestCountSub={() => guestCountSub('children')}
                      guestsTitle="Children"
                      category="children"
                    />
                    <AddGuests
                      guestCount={guests.infants}
                      guestCountAdd={() => guestCountAdd('infants')}
                      guestCountSub={() => guestCountSub('infants')}
                      guestsTitle="Infants"
                      category="infants"
                    />
                    <AddGuests
                      guestCount={guests.pets}
                      guestCountAdd={() => guestCountAdd('pets')}
                      guestCountSub={() => guestCountSub('pets')}
                      guestsTitle="Pets"
                      category="pets"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <button className="bg-[#00773d] text-[#fff] border-0 py-[9px] px-[17px] rounded-full cursor-pointer w-[50px] h-[50px]">
            <Image src={SearchIcon} alt="search" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SearchBar
