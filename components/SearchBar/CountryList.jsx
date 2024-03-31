import React, { useEffect } from 'react';
import { useState } from 'react';
import hotelData from '../../data/CountryList.json';

function CountryList({ setSelectedLocation, setIsLocationDropdownOpen }) {

    console.log("hoteldata", hotelData[0].location.location)

    const handleAddressClick = (address) => {
        setSelectedLocation(address);
        setIsLocationDropdownOpen(false);
    };

    return (
        <div>
            {hotelData.map((loc) => (
                <div className="bg-white flex flex-col gap-2 text-black text-md font-semibold" key={loc.id} onClick={() => handleAddressClick(loc.location.location)}>
                    <div className="p-4 hover:bg-slate-300 cursor-pointer">{loc.location.location}</div>
                </div>
            ))}
        </div>

    );
}

export default CountryList;