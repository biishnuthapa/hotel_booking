import React, { useEffect, useState } from 'react'

const Features = () => {
  const [features, setFeatures] = useState([])

  useEffect(() => {
    fetch(
      'https://gold-adorable-lemming-359.mypinata.cloud/ipfs/QmUZeQXgpR4ANHKPeRVCEQ1hAvDmnqzzEMRhGgzMEdvQcR'
    )
      .then((response) => response.json())
      .then((data) => setFeatures(data))
      .catch((error) => console.error('Error fetching JSON:', error))
  }, [])

  return (
    <div className="mt-8 flex rounded-2xl">
      <div className="grid max-w-sm gap-2 sm:max-w-none sm:grid-cols-2 lg:gap-4 lg:grid-cols-5">
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/cityview.png"
            alt="City view"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">City view</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/pawprint.png"
            alt="Pet friendly"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">Pet friendly</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/swimming.png"
            alt="Swimming pool"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">Swimming pool</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/wifi.png"
            alt="Free WiFi"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">Free WiFi</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/terrace.png"
            alt="Terrace"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">Terrace</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/parking.png"
            alt="Free parking"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">Free parking</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/air-conditioning.png"
            alt="Air conditioning"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">Air conditioning</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/private.png"
            alt="Private bathroom"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">Private bathroom</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/24-hours.png"
            alt="24-hour front desk"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">24-hour front desk</p>
        </div>
        <div className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4">
          <img
            src="/assets/flati_icon/access.png"
            alt="Key card access"
            className="h-20 w-20 rounded-lg object-none"
          />
          <p className="text-sm font-medium">Key card access</p>
        </div>
      </div>
    </div>
  )
}

export default Features
