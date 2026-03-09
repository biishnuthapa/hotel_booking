import { useState } from 'react'
import { truncate } from '@/utils/helper'
import { useAccount } from 'wagmi'
import { toast } from 'react-toastify'
import { useRouter } from 'next/router'
import { FaTimes } from 'react-icons/fa'
import { getApartment, updateApartment } from '@/services/blockchain'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

export default function EditApartment({ apartment }) {
  const { address } = useAccount()
  const navigate = useRouter()

  const [name, setName] = useState(apartment.name)
  const [description, setDescription] = useState(apartment.description)
  const [location, setLocation] = useState(apartment.location)
  const [rooms, setRooms] = useState(apartment.rooms)
  const [images, setImages] = useState('')
  const [price, setPrice] = useState(apartment.price)
  const [links, setLinks] = useState(apartment.images)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !location || !description || !rooms || links.length !== 5 || !price) {
      toast.error('Please complete all fields and keep exactly 5 image links.')
      return
    }

    const params = {
      ...apartment,
      name: name.trim(),
      description: description.trim(),
      location: location.trim(),
      rooms: Number(rooms),
      images: links.slice(0, 5).join(','),
      price,
    }

    toast.promise(
      new Promise((resolve, reject) => {
        updateApartment(params)
          .then(() => {
            navigate.push('/room/' + apartment.id)
            resolve()
          })
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Apartment updated successfully.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  const addImage = (e) => {
    e.preventDefault()
    if (!images.trim()) return
    if (links.length !== 5) setLinks((prevState) => [...prevState, images.trim()])
    setImages('')
  }

  const removeImage = (e, index) => {
    e.preventDefault()
    links.splice(index, 1)
    setLinks(() => [...links])
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-2xl font-semibold text-slate-900">Edit Property</h1>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input
            className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="text"
            placeholder="Property Name"
            onChange={(e) => setName(e.target.value)}
            value={name}
            required
          />
          <input
            className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="number"
            step={0.01}
            min={0.01}
            placeholder="Nightly Price (ETH)"
            onChange={(e) => setPrice(e.target.value)}
            value={price}
            required
          />

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
              type="url"
              placeholder="Image URL"
              onChange={(e) => setImages(e.target.value)}
              value={images}
            />
            {links.length !== 5 && (
              <button
                onClick={addImage}
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Add
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                <span>{truncate(link, 6, 8, 22)}</span>
                <button onClick={(e) => removeImage(e, i)} type="button" className="text-slate-500">
                  <FaTimes />
                </button>
              </div>
            ))}
          </div>

          <input
            className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="text"
            placeholder="Location"
            onChange={(e) => setLocation(e.target.value)}
            value={location}
            required
          />
          <input
            className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="number"
            min={1}
            placeholder="Number of rooms"
            onChange={(e) => setRooms(e.target.value)}
            value={rooms}
            required
          />
          <textarea
            className="h-28 rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            placeholder="Description"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
            required
          />

          <button
            type="submit"
            className={`rounded-xl bg-[#00773d] py-3 font-semibold text-white transition hover:brightness-110 ${
              !address ? 'cursor-not-allowed opacity-50' : ''
            }`}
            disabled={!address}
          >
            Update Apartment
          </button>
        </form>
      </div>
    </div>
  )
}

export const getServerSideProps = async (context) => {
  const { roomId } = context.query
  const apartment = await getApartment(roomId)
  return {
    props: {
      apartment: JSON.parse(JSON.stringify(apartment)),
    },
  }
}
