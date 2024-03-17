import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import SearchIcon from '../../public/assets';
import DatePicker from 'react-datepicker'; // Import DatePicker
import 'react-datepicker/dist/react-datepicker.css'; // Import DatePicker styles
import AddGuests from './AddGuests';
import CountryList from './CountryList';

function SearchBar({ 
  selectedLocation, 
  setSelectedLocation, 
  checkInDate, 
  setCheckInDate, 
  checkOutDate, 
  setCheckOutDate, 
  guests, 
  setGuests, 
  onSearch 
}) {
  const toggleLocationDropdown = () => {
    setIsLocationDropdownOpen(!isLocationDropdownOpen);
  };

  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isGuestsDropdownOpen, setIsGuestsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsGuestsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  const toggleGuestsDropdown = () => {
    setIsGuestsDropdownOpen(!isGuestsDropdownOpen);
  };

  const guestCountAdd = (category) => {
    setGuests((prevGuests) => ({
      ...prevGuests,
      [category]: prevGuests[category] + 1,
    }));
  };

  const guestCountSub = (category) => {
    setGuests((prevGuests) => ({
      ...prevGuests,
      [category]: Math.max(prevGuests[category] - 1, 0),
    }));
  };

  const totalGuests = guests.adults + guests.children;
  const totalPets = guests.pets;
  const totalInfants = guests.infants;

  let whoText = 'Add guests';

  if (totalGuests > 0) {
    whoText = `${totalGuests} Guest${totalGuests !== 1 ? 's' : ''}`;
  }
  if (totalInfants > 0) {
    whoText += `, ${totalInfants} Infant${totalInfants !== 1 ? 's' : ''}`;
  }

  if (totalPets > 0) {
    whoText += `, ${totalPets} Pet${totalPets !== 1 ? 's' : ''}`;
  }

  // Get current date
  const currentDate = new Date();

  return (
    <div className="flex flex-wrap justify-center z-50">
      <div className="bg-transparent border-2 border-[#ccc] rounded-full shadow-lg p-3 mt-[24px] w-fit flex justify-center">
        <div className="flex flex-wrap items-center">
          <div className="flex flex-wrap flex-col mr-[10px] ml-[20px] border-r-2 border-[#C7C6C1]">
            {/* Where */}
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
          {/* Check-in */}
          <div className="flex flex-wrap flex-col mr-[10px] ml-[20px]  border-r-2 border-[#ccc]">
            <label htmlFor="check-in" className="mr-[5px]">
              Check-in
            </label>
            <div className="relative">
              <DatePicker
                autoComplete='off'
                selected={checkInDate}
                onChange={(date) => setCheckInDate(date)}
                placeholderText="YYYY-MM-DD (Check In)"
                dateFormat="yyyy-MM-dd"
                minDate={currentDate} // Set minDate to currentDate
                required
                className="outline-none bg-transparent"
              />
            </div>
          </div>
          {/* Check-out */}
          <div className="flex flex-wrap flex-col mr-[10px] ml-[20px]  border-r-2 border-[#ccc]">
            <label htmlFor="check-out" className="mr-[5px]">
              Check-out
            </label>
            <div className="relative">
              <DatePicker
                autoComplete='off'
                selected={checkOutDate}
                onChange={(date) => setCheckOutDate(date)}
                placeholderText="YYYY-MM-DD (Check out)"
                dateFormat="yyyy-MM-dd"
                minDate={checkInDate || currentDate} // Set minDate to checkInDate or currentDate
                required
                className="outline-none bg-transparent"
              />
            </div>
          </div>
          {/* Who */}
          <div className="flex flex-wrap flex-col mr-[10px] ml-[20px] border-[#ccc] border-r-0">
            <label htmlFor="guests" className="mr-[5px]">
              Who
            </label>
            <div className="relative">
              <input
                className="w-[200px] outline-none bg-transparent"
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
          {/* Search Button */}
          <button 
            className="bg-[#00773d] flex flex-wrap text-[#fff] border-0 py-[9px] px-[17px] rounded-full cursor-pointer w-[50px] h-[50px]"
            onClick={onSearch}
          >
            <Image src={SearchIcon} alt="search" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
