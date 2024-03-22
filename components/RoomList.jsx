import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getRooms } from '@/services/blockchain'

const RoomList = ({ apartmentId }) => {
  const [rooms, setRooms] = useState([])
  const [selectedRoomImages, setSelectedRoomImages] = useState([])

  useEffect(() => {
    const fetchRoomsData = async () => {
      try {
        const roomData = await getRooms(apartmentId)
        setRooms(roomData)
      } catch (error) {
        console.error('Error fetching rooms:', error)
      }
    }

    fetchRoomsData()
  }, [apartmentId])

  const handleRoomClick = (roomImages) => {
    setSelectedRoomImages(roomImages)
    // Open modal or popup here to display images
  }

  return (
    <div className="my-8 bg-white shadow rounded-md overflow-hidden">
      <div className="border-b border-gray-200">
        <h2 className="text-lg font-semibold px-4 py-2 bg-gray-100">Available Rooms</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Room Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Capacity
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Description
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Price
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rooms.map((room, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{room.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{room.capacity}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{room.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{room.price}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600"
                    onClick={() => handleRoomClick(room.images[0])}
                  >
                    Show Prices
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RoomList
