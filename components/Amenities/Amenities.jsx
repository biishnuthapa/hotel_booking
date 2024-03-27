import React from 'react';

const Amenities = () => {
  const facilities = [
    { name: 'Free WiFi', included: true },
    { name: 'Breakfast', included: true },
    { name: 'Gym Access', included: false },
    { name: 'Parking', included: false },
    { name: 'Airport Shuttle Service', included: true },
    { name: 'Swimming Pool Access', included: true },
    { name: 'Spa Access', included: false },
    { name: 'Daily Housekeeping', included: true },
    { name: 'Complimentary Toiletries', included: true },
  ];

  return (
    <div className="border rounded-md p-4 mb-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xl font-medium text-gray-500 uppercase tracking-wider">Facility</th>
              <th scope="col" className="px-6 py-3 text-left text-xl font-medium text-gray-500 uppercase tracking-wider">Included</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {facilities.map((facility, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap">{facility.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {facility.included ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Yes</span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Amenities;
