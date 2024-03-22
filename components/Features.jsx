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
    <div className="my-8 bg-white shadow rounded-md overflow-hidden">
      <div className="grid max-w-sm gap-2 sm:max-w-none sm:grid-cols-2 lg:gap-4 lg:grid-cols-5">
        {features.map(
          (feature, index) =>
            feature.enabled && (
              <div
                key={index}
                className="flex flex-row items-center space-y-1 border border-gray-300 rounded-lg py-2 pl-4 pr-4"
              >
                <img
                  src={`/assets/flati_icon/${feature.icon}`}
                  alt={feature.name}
                  className="h-20 w-20 rounded-lg object-none"
                />
                <p className="text-sm font-medium">{feature.icon_name}</p>
              </div>
            )
        )}
      </div>
    </div>
  )
}

export default Features
