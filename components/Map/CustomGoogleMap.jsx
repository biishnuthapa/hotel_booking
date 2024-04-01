import React, { useState } from 'react'
import { LoadScript, GoogleMap, Marker } from '@react-google-maps/api'

const libraries = ['places'] // Optional for place search, etc.

const CustomGoogleMap = ({ center, zoom, apiKey }) => {
  const [map, setMap] = useState(null)

  const handleLoad = (mapInstance) => {
    setMap(mapInstance)
  }

  const containerStyle = {
    width: '100vw',
    height: '70vh',
  }

  return (
    <div className="my-8 bg-white shadow rounded-md overflow-hidden">
      <LoadScript
        googleMapsApiKey={apiKey} // Receive API key as a prop
        libraries={libraries}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          zoom={zoom} // Receive zoom level as a prop
          center={center} // Receive center coordinates as a prop
          onLoad={handleLoad}
        >
          {map && <Marker position={center} />}
        </GoogleMap>
      </LoadScript>
    </div>
  )
}

export default CustomGoogleMap
