import React, { useState } from 'react'
import { addRoomTypeToApartment } from '@/services/blockchain'
import { toast } from 'react-toastify'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const CreateRoomType = ({ apartmentId, onClose }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [details, setDetails] = useState('')
  const [capacity, setCapacity] = useState('')

  const handleCreateRoomType = async () => {
    if (!name || !description || !price || !details || !capacity) {
      toast.error('All room fields are required.')
      return
    }

    toast.promise(
      new Promise((resolve, reject) => {
        addRoomTypeToApartment(apartmentId, name, description, price, details, capacity)
          .then(() => {
            setName('')
            setDescription('')
            setPrice('')
            setDetails('')
            setCapacity('')
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

  return (
    <div className="w-[92vw] max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Add Room Type</h3>
        <button onClick={onClose} className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">
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
        <input
          type="url"
          className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Room details JSON URL"
        />
        <input
          type="number"
          min={1}
          className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Capacity"
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
