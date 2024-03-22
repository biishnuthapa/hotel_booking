import React, { useState } from 'react'
import { addRoomTypeToApartment } from '@/services/blockchain'
import { toast } from 'react-toastify'

const CreateRoomType = ({ apartmentId, onClose }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [images, setImages] = useState('')
  const [capacity, setCapacity] = useState('')

  const handleCreateRoomType = async () => {
    try {
      // Validate input fields
      if (!name || !description || !price || !images || !capacity) {
        throw new Error('All fields are required')
      }

      // Display pending toast
      toast.info('Approve transaction...')

      // Call the function to create a room type
      await addRoomTypeToApartment(apartmentId, name, description, price, images, capacity)

      // Clear input fields after successfully creating the room type
      setName('')
      setDescription('')
      setPrice('')
      setImages('')
      setCapacity('')

      toast.success('RoomType submitted successfully 👌')
    } catch (error) {
      toast.error('Encountered error 🤯')
      console.error('Error creating room type:', error.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <span className="absolute top-0 right-0 cursor-pointer" onClick={onClose}>
          <svg
            className="h-6 w-6 text-gray-600"
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
          </svg>
        </span>
        <h3 className="text-lg font-semibold mb-4">Create Room Type</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Name:</label>
          <input
            type="text"
            className="w-full border-gray-300 rounded-md p-2 focus:outline-none focus:ring focus:border-blue-300"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Description:</label>
          <input
            type="text"
            className="w-full border-gray-300 rounded-md p-2 focus:outline-none focus:ring focus:border-blue-300"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Price:</label>
          <input
            type="number"
            className="w-full border-gray-300 rounded-md p-2 focus:outline-none focus:ring focus:border-blue-300"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Images:</label>
          <input
            type="text"
            className="w-full border-gray-300 rounded-md p-2 focus:outline-none focus:ring focus:border-blue-300"
            value={images}
            onChange={(e) => setImages(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Capacity:</label>
          <input
            type="number"
            className="w-full border-gray-300 rounded-md p-2 focus:outline-none focus:ring focus:border-blue-300"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
        <button
          className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring focus:border-blue-300"
          onClick={handleCreateRoomType}
        >
          Create Room Type
        </button>
      </div>
    </div>
  )
}

export default CreateRoomType
