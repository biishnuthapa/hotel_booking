import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import Image from 'next/image'
import SearchIcon from '../../public/assets'
import DatePicker from 'react-datepicker' // Import DatePicker
import 'react-datepicker/dist/react-datepicker.css' // Import DatePicker styles
import AddGuests from './AddGuests'
import CountryList from './CountryList'
import { filterApartmentsByLocation } from '@/services/blockchain'

function SearchBar({
  selectedLocation,
  setSelectedLocation,
  checkInDate,
  setCheckInDate,
  checkOutDate,
  setCheckOutDate,
  guests,
  setGuests,
  apartments,
}) {
  const toggleLocationDropdown = () => {
    setIsLocationDropdownOpen(!isLocationDropdownOpen)
  }

  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false)
  const [isGuestsDropdownOpen, setIsGuestsDropdownOpen] = useState(false)

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

  const currentDate = new Date()
  const router = useRouter()

  const handleSearch = async () => {
    try {
      const filteredApartments = await filterApartmentsByLocation(apartments, selectedLocation)
      const apartmentsWithSerializedBigInts = filteredApartments.map((apartment) => {
        const serializedApartment = { ...apartment }
        for (const key in serializedApartment) {
          if (Object.prototype.hasOwnProperty.call(serializedApartment, key)) {
            if (typeof serializedApartment[key] === 'bigint') {
              serializedApartment[key] = serializedApartment[key].toString()
            }
          }
        }
        return serializedApartment
      })
      router.push({
        pathname: '/SearchPage',
        query: { filteredApartments: JSON.stringify(apartmentsWithSerializedBigInts) },
      })
    } catch (error) {
      console.error('Error filtering apartments:', error)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center lg:flex-row lg:justify-center z-50">
      <div className="bg-transparent border-2 border-[#ccc] lg:rounded-full rounded-[20px] shadow-lg p-3 mt-[24px] w-[94vw] lg:w-fit flex flex-col lg:flex-row lg:items-center">
        <div className="flex flex-col lg:mr-[10px] lg:ml-[20px] border-r-0 lg:border-r-2 lg:border-[#C7C6C1]">
          <label htmlFor="location" className="mr-[5px]">
            Where
          </label>
          <div className="relative">
            <input
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full lg:w-[300px] border-0 rounded-sm bg-transparent outline-none"
              type="text"
              id="location"
              placeholder="Destination"
              onClick={(e) => {
                const targetClassList = Array.from(e.target.classList)
                if (!targetClassList.includes('arrow-icon-class')) {
                  toggleLocationDropdown()
                }
              }}
            />

            {isLocationDropdownOpen && (
              <div
                className="dropdown-content absolute bg-white shadow-lg rounded-lg mt-1 left-0"
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
        <div className="flex flex-row">
          <div className="flex flex-col sm:w-[300px] md:w-[400px] w-[180px] lg:w-full lg:mr-[10px] lg:ml-[20px] mt-4 lg:mt-0 border-r-0 lg:border-r-2 border-[#ccc]">
            <label htmlFor="check-in" className="mr-[5px]">
              Check-in
            </label>
            <div className="relative">
              <DatePicker
                autoComplete="off"
                selected={checkInDate}
                onChange={(date) => setCheckInDate(date)}
                placeholderText="YYYY-MM-DD (Check In)"
                dateFormat="yyyy-MM-dd"
                minDate={currentDate} // Set minDate to currentDate
                required
                className="outline-none bg-transparent lg:w-full sm:w-[250px] md:w-[350px] w-[150px]"
              />
            </div>
          </div>
          {/* Check-out */}
          <div className="flex flex-col sm:w-[300px] md:w-[400px] w-[180px] lg:w-full lg:mr-[10px] lg:ml-[20px] mt-4 lg:mt-0 border-r-0 lg:border-r-2 border-[#ccc]">
            <label htmlFor="check-out" className="mr-[5px]">
              Check-out
            </label>
            <div className="relative">
              <DatePicker
                autoComplete="off"
                selected={checkOutDate}
                onChange={(date) => setCheckOutDate(date)}
                placeholderText="YYYY-MM-DD (Check out)"
                dateFormat="yyyy-MM-dd"
                minDate={checkInDate || currentDate} // Set minDate to checkInDate or currentDate
                required
                className="outline-none bg-transparent lg:w-full sm:w-[250px] md:w-[350px] w-[150px]"
                popperPlacement="bottom"
                popperModifiers={{
                  flip: {
                    behavior: ['bottom'], // don't allow it to flip to be above
                  },
                  preventOverflow: {
                    enabled: false, // tell it not to try to stay within the view (this prevents the popper from covering the element you clicked)
                  },
                  hide: {
                    enabled: false, // turn off since needs preventOverflow to be enabled
                  },
                }}
              />
            </div>
          </div>
        </div>
        {/* Who */}
        <div className="flex flex-col  lg:mr-[10px] lg:ml-[20px] mt-4 lg:mt-0 border-[#ccc] lg:border-r-0">
          <label htmlFor="guests" className="mr-[5px]">
            Who
          </label>
          <div className="relative">
            <input
              className="w-full lg:w-[200px] outline-none bg-transparent"
              type="text"
              id="guests"
              placeholder={whoText}
              onClick={toggleGuestsDropdown}
              readOnly
            />
            {isGuestsDropdownOpen && (
              <div
                className="dropdown-content absolute bg-white shadow-lg rounded-lg mt-1 right-0"
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
        {/* Search Button */}
        <button
          className="bg-[#00773d] flex flex-row flex-wrap text-[#fff] border-0 py-[16px] justify-center px-[17px] rounded-full cursor-pointer lg:w-[50px] lg:h-[50px] mt-4 lg:mt-0"
          onClick={handleSearch} //
        >
          <Image className="lg:block hidden" src={SearchIcon} alt="search" />
          <span className="lg:hidden text-xl block ml-2">Search</span>
        </button>
      </div>
    </div>
  )
}

export default SearchBar
