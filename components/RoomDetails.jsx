import React, { useState } from 'react'

const RoomDetails = ({ onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const handlePrevImage = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? roomData.otherImageUrls.length - 1 : prevIndex - 1
    )
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === roomData.otherImageUrls.length - 1 ? 0 : prevIndex + 1
    )
  }

  const roomData = {
    name: 'Example Room',
    size: '20 m²',
    views: ['Mountain view', 'City view'],
    amenities: ['Free WiFi', 'Air conditioning', 'TV'],
    reviews: '4.5/5 - Based on 100 reviews',
    description:
      'This is a description of the room. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    sharedBathroom: ['Free toiletries', 'Toilet', 'Shower'],
    facilities: ['Air conditioning', 'Heating', 'Desk'],
    smoking: false,
    mainImageUrl: '',
    otherImageUrls: [
      'https://images.pexels.com/photos/16821924/pexels-photo-16821924/free-photo-of-pretty-blonde-wearing-a-black-bustier.jpeg',
      'https://images.pexels.com/photos/18127596/pexels-photo-18127596/free-photo-of-portrait-of-a-pretty-brunette-standing-outdoors-with-raised-arms.jpeg',
      'https://via.placeholder.com/100x100',
    ],
  }
  roomData.mainImageUrl = roomData.otherImageUrls[currentImageIndex]

  return (
    <div className='relative'>
      <div className='absolute top-[0px] right-[0px]'><button onClick={onClose}> <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg></button></div>

      <div className="flex max-w-4xl mx-auto">
        <div className="flex flex-col w-2/3">
          <div className="relative">
            {/* Render main room view image */}
            <img
              alt="Main room view"
              className="w-full h-auto"
              src={roomData.mainImageUrl}
              style={{
                aspectRatio: '600/400',
                objectFit: 'cover',
              }}
            />
            {/* Buttons for navigating through images */}
            {roomData.otherImageUrls.length > 1 && (
              <>
                <button
                  className="absolute top-1/2 left-0 ml-2 text-white bg-black bg-opacity-50 px-2 py-1"
                  onClick={handlePrevImage}
                >
                  ‹
                </button>
                <button
                  className="absolute top-1/2 right-0 mr-2 text-white bg-black bg-opacity-50 px-2 py-1"
                  onClick={handleNextImage}
                >
                  ›
                </button>
              </>
            )}
            {/* Render other room view images */}
            <div className="flex mt-2 space-x-2 overflow-x-auto">
              {roomData.otherImageUrls.map((imageUrl, index) => (
                <img
                  key={index}
                  alt={`Room view ${index + 1}`}
                  className="flex-none w-24 h-24"
                  height="100"
                  src={imageUrl}
                  style={{
                    aspectRatio: '100/100',
                    objectFit: 'cover',
                  }}
                  width="100"
                />
              ))}
            </div>
          </div>
          {/* Other room details */}
        </div>
        <div className="w-1/3 pl-6">
          <h2 className="text-xl font-semibold">{roomData.name}</h2>
          {/* Render other room details */}
          <div className="flex items-center mt-2 space-x-2 text-sm">
            <span>{roomData.size}</span>
            {roomData.views.map((view, index) => (
              <React.Fragment key={index}>
                <span>{view}</span>
              </React.Fragment>
            ))}
          </div>
          <p className="mt-4 font-medium">{roomData.size}</p>
          <p className="mt-1 text-sm">{roomData.reviews}</p>
          <p className="mt-4 text-sm">{roomData.description}</p>
          <h3 className="mt-4 font-semibold">In your shared bathroom:</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {roomData.sharedBathroom.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <h3 className="mt-4 font-semibold">View:</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {roomData.views.map((view, index) => (
              <li key={index}>{view}</li>
            ))}
          </ul>
          <h3 className="mt-4 font-semibold">Facilities:</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {roomData.facilities.map((facility, index) => (
              <li key={index}>{facility}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">Smoking: {roomData.smoking ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  )
}

export default RoomDetails
