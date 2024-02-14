import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faDollarSign, 
  faStar, 
  faComment, 
  faWheelchair, 
  faBriefcase,
  faWifi,
  faSwimmingPool,
  faCar,
} from '@fortawesome/free-solid-svg-icons';

function HotelFilters() {
  const filterOptions = [
    { name: 'Price', icon: faDollarSign },
    { name: 'Star Rating', icon: faStar },
    { name: 'Review', icon: faComment },
    { name: 'Accessibility', icon: faWheelchair },
    { name: 'Business-oriented', icon: faBriefcase },
    { name: 'Wi-Fi', icon: faWifi },
    { name: 'Swimming Pool', icon: faSwimmingPool },
    { name: 'Parking', icon: faCar },
  ];

  const [selectedFilters, setSelectedFilters] = useState([]);

  const toggleFilter = (filterName) => {
    if (selectedFilters.includes(filterName)) {
      setSelectedFilters(selectedFilters.filter((filter) => filter !== filterName));
    } else {
      setSelectedFilters([...selectedFilters, filterName]);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-6">
      {filterOptions.map((filter, index) => (
        <div key={index} className="flex flex-col items-center cursor-pointer" onClick={() => toggleFilter(filter.name)}>
          <FontAwesomeIcon icon={filter.icon} className="text-xl text-white" />
          <span className={`text-sm font-medium ${selectedFilters.includes(filter.name) ? 'text-[#00773d]' : 'text-white'}`}>{filter.name}</span>
        </div>
      ))}
    </div>
  );
}

export default HotelFilters;
