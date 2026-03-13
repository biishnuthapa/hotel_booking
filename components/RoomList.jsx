import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import { useAccount } from 'wagmi'
import { deleteRoomType, getRooms } from '@/services/blockchain'
import RoomDetails from '@/components/RoomDetails'

const RoomList = ({ apartmentId, apartmentOwner }) => {
  const [rooms, setRooms] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const { address } = useAccount()
  const isOwner =
    apartmentOwner && address && apartmentOwner.toLowerCase() === address.toLowerCase()

  const loadRooms = useCallback(async () => {
    try {
      const id = Number(apartmentId)
      if (!Number.isFinite(id) || id <= 0) return

      const roomData = await getRooms(id)
      setRooms(roomData)
    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }, [apartmentId])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const handleRoomClick = (room) => {
    setSelectedRoom(room)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setSelectedRoom(null)
    setShowModal(false)
  }

  const handleDeleteRoom = (roomId) => {
    if (roomId === undefined || roomId === null) return

    toast.promise(
      new Promise((resolve, reject) => {
        deleteRoomType(apartmentId, roomId)
          .then(async () => {
            await loadRooms()
            resolve()
          })
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Room type deleted.',
        error: {
          render({ data }) {
            return (
              data?.shortMessage || data?.reason || data?.message || 'Failed to delete room type.'
            )
          },
        },
      }
    )
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Room Types</h2>
        <p className="text-sm text-slate-500">{rooms.length} option(s)</p>
      </div>

      <div className="grid gap-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="text-base font-semibold text-slate-900">{room.name}</p>
              <p className="mt-1 text-sm text-slate-600">{room.description}</p>
              <p className="mt-2 text-sm text-slate-500">Rooms available: {room.capacity}</p>
              <p className="text-sm font-medium text-[#00773d]">{room.price} ETH / night</p>
            </div>
            <div className="flex items-center">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00773d] hover:text-[#00773d]"
                onClick={() => handleRoomClick(room)}
              >
                View details
              </button>
              {isOwner && (
                <button
                  className="ml-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100"
                  onClick={() => handleDeleteRoom(room.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}

        {rooms.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No room types available yet for this apartment.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <RoomDetails onClose={handleCloseModal} room={selectedRoom} />
        </div>
      )}
    </section>
  )
}

export default RoomList
