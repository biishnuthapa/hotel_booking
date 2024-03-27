import React, { useEffect } from 'react';
import { useState } from 'react';
import apiInstance from '../../services/apiServices/apiInstances';

function CountryList({ setSelectedLocation, setIsLocationDropdownOpen }) {
    const [isLoading, setIsLoading] = useState(true);
    const [location, setLocation] = useState([]);

    useEffect(() => {
        const fetchLocation = async () => {
            setIsLoading(true);
            try {
                const response = await apiInstance.get('users/?limit=10');
                setLocation(response.data.users);
            } catch (error) {
                // Handle error
            } finally {
                setIsLoading(false);
            }
        };

        fetchLocation();
    }, []);

    const handleAddressClick = (address) => {
        setSelectedLocation(address);
        setIsLocationDropdownOpen(false);
    };

    return (
        <div>
            {isLoading ? (
                <div className="loader">Loading</div>
            ) : (
                <div>
                    {location.map((loc) => (
                        <div className="bg-white flex flex-col gap-2 text-black text-md font-semibold" key={loc.id} onClick={() => handleAddressClick(loc.address.address)}>
                            <div className="p-4">{loc.address.address}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CountryList;