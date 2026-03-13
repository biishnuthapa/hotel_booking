import React, { useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import { truncate } from '@/utils/helper'
import { addRoomTypeToApartment } from '@/services/blockchain'
import { toast } from 'react-toastify'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const CreateRoomType = ({ apartmentId, onClose }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [capacity, setCapacity] = useState('')
  const [images, setImages] = useState('')
  const [links, setLinks] = useState([])

  const handleCreateRoomType = async () => {
    if (!name || !description || !price || !capacity || links.length === 0) {
      toast.error('All room fields are required.')
      return
    }

    toast.promise(
      new Promise((resolve, reject) => {
        addRoomTypeToApartment(
          apartmentId,
          name,
          description,
          price,
          links.join(','),
          capacity
        )
          .then(() => {
            setName('')
            setDescription('')
            setPrice('')
            setCapacity('')
            setLinks([])
            setImages('')
            if (typeof onClose === 'function') onClose()
            resolve()
          })
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Room type added successfully.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  const addImage = () => {
    if (!images.trim()) return
    if (links.length < 5) {
      setLinks((prevState) => [...prevState, images.trim()])
    } else {
      toast.error('You can only add a maximum of 5 images.')
    }
    setImages('')
  }

  const removeImage = (index) => {
    links.splice(index, 1)
    setLinks(() => [...links])
  }

  return (
    <div className="w-[92vw] max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Add Room Type</h3>
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      <div className="grid gap-3">
        <input
          type="text"
          className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Room name"
        />
        <textarea
          className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Room description"
          rows={3}
        />
        <input
          type="number"
          step={0.01}
          min={0.01}
          className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price in ETH"
        />
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="url"
            placeholder="Image URL"
            onChange={(e) => setImages(e.target.value)}
            value={images}
          />
          <button
            onClick={addImage}
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((link, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
            >
              <span>{truncate(link, 6, 8, 22)}</span>
              <button
                onClick={() => removeImage(i)}
                type="button"
                className="text-slate-500"
              >
                <FaTimes />
              </button>
            </div>
          ))}
        </div>
        <input
          type="number"
          min={1}
          className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Number of rooms available"
        />
      </div>

      <button
        className="mt-4 w-full rounded-xl bg-[#00773d] p-3 font-semibold text-white transition hover:brightness-110"
        onClick={handleCreateRoomType}
      >
        Save Room Type
      </button>
    </div>
  )
}

export default CreateRoomType
