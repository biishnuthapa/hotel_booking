import React, { useState, useEffect } from "react";
import { Map, Marker, GoogleApiWrapper } from "google-maps-react";

function MapComponent({ location, google, setHighLight }) { // Change props to accept location instead of locations
    const [center, setCenter] = useState();

    useEffect(() => {
        if (location) { // Check if location is provided
            setCenter({ lat: location.lat, lng: location.lng }); // Set center to provided location
        }
    }, [location]); // Update dependency array to watch for changes in location

    return (
        <>
            {center && (
                <Map
                    google={google}
                    initialCenter={center}
                    zoom={13}
                    disableDefaultUI={true}
                >
                    {location && ( // Check if location is provided
                        <Marker
                            position={location}
                            onClick={() => setHighLight(0)} // Assuming you're setting highlight for the single marker
                        />
                    )}
                </Map>
            )}
        </>
    );
}

export default GoogleApiWrapper({
    apiKey: process.env.REACT_APP_API_KEY,
})(MapComponent);
