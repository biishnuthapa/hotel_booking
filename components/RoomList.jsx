import React, { useState, useEffect } from 'react'
import { getRooms } from '@/services/blockchain'
import RoomDetails from '@/components/RoomDetails'

const RoomList = ({ apartmentId }) => {
  const [rooms, setRooms] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)

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

  const handleRoomClick = (room) => {
    setSelectedRoom(room)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setSelectedRoom(null)
    setShowModal(false)
  }

  return (
    <div className="my-8 bg-white shadow rounded-md overflow-hidden">
      <div className="border-b border-gray-200">
        <h2 className="text-lg font-semibold px-4 py-2 bg-gray-100">Available Rooms</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
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
                Number of Guest
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
                Price($)
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
                <td className="px-6 py-4 ">
                  <div className="text-sm text-gray-900 break-words">{room.name}</div>
                </td>
                <td className="px-6 py-4 ">
                  <div className="text-sm md:text-base text-gray-900">{room.capacity}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs md:text-base text-gray-900 break-words">
                    {room.description}
                  </div>
                </td>
                <td className="px-6 py-4 ">
                  <div className="text-sm  md:text-base text-gray-900">{room.price}</div>
                </td>
                <td className="px-6 py-4 ">
                  <button
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600"
                    onClick={() => handleRoomClick(room)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="bg-white p-8 rounded-md max-w-full w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2">
            <RoomDetails onClose={handleCloseModal} jsonLink={selectedRoom?.details} />
          </div>
        </div>
      )}
    </div>
  )
}

export default RoomList
