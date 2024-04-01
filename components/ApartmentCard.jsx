import React from 'react'

const ApartmentCard = ({ apartment }) => {
  return (
    <div className="flex flex-col max-w-xs mx-auto bg-white shadow-md rounded-lg overflow-hidden">
      <div className="h-40">
        <img
          className="w-full h-full object-cover"
          src={apartment[4].split(',')[0]}
          alt={apartment[1]}
        />
      </div>
      <div className="p-4">
        <h2 className="font-semibold text-lg">{apartment[1]}</h2>
        <p className="text-gray-600 text-sm mt-2">{apartment[2].slice(0, 50)}...</p>
        <div className="flex justify-between items-center mt-4">
          <p>Total Rooms: {apartment[5]}</p>
          <p>Price: {apartment[6]}</p>
        </div>
        <p className="text-gray-600 text-xs mt-2">Location: {apartment[11]}</p>
      </div>
    </div>
  )
}

export default ApartmentCard
