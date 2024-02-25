import React, { useState } from 'react';
import SearchBar from './SearchBar';

function ParentComponent() {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [checkOutDate, setCheckOutDate] = useState(null);
  const [guests, setGuests] = useState({
    adults: 0,
    children: 0,
    infants: 0,
    pets: 0,
  });

  const handleSearch = () => {
    // Check if selectedLocation, checkOutDate, and guests are filled
    if (selectedLocation && checkOutDate && guests.adults > 0) {
      // Perform search if all fields are filled
      alert('Performing search...');
    } else {
      // Alert user to fill all required fields
      alert('Please fill all required fields.');
    }
  };
  
  return (
    <div>
      <SearchBar
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        checkOutDate={checkOutDate}
        setCheckOutDate={setCheckOutDate}
        guests={guests}
        setGuests={setGuests}
        onSearch={handleSearch}
      />
    </div>
  );
}

export default ParentComponent;
