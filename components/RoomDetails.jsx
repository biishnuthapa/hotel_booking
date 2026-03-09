import React, { useState, useEffect } from 'react'
import { normalizeIpfsUrl } from '@/utils/helper'

const RoomDetails = ({ onClose, jsonLink }) => {
  const [roomData, setRoomData] = useState(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchRoomData = async () => {
      if (!jsonLink) {
        setError('Room details link is missing.')
        return
      }

      try {
        setError('')
        const response = await fetch(normalizeIpfsUrl(jsonLink))
        if (!response.ok) {
          throw new Error(`Failed to fetch room details (${response.status})`)
        }
        const data = await response.json()
        const normalizedImages = (data.otherImageUrls || [])
          .map((url) => normalizeIpfsUrl(url))
          .filter(Boolean)

        setRoomData({
          ...data,
          mainImageUrl: normalizeIpfsUrl(data.mainImageUrl || normalizedImages[0] || ''),
          otherImageUrls: normalizedImages,
          facilities: data.facilities || [],
          sharedBathroom: data.sharedBathroom || [],
          views: data.views || [],
        })
        setCurrentImageIndex(0)
      } catch (fetchError) {
        setError(fetchError.message || 'Could not load room details.')
      }
    }

    fetchRoomData()
  }, [jsonLink])

  const handlePrevImage = () => {
    if (!roomData?.otherImageUrls?.length) return
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? roomData.otherImageUrls.length - 1 : prevIndex - 1
    )
  }

  const handleNextImage = () => {
    if (!roomData?.otherImageUrls?.length) return
    setCurrentImageIndex((prevIndex) =>
      prevIndex === roomData.otherImageUrls.length - 1 ? 0 : prevIndex + 1
    )
  }

  if (error) {
    return (
      <div className="w-[88vw] max-w-3xl rounded-3xl bg-white p-6 text-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Room Details</h3>
          <button onClick={onClose} className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!roomData) {
    return (
      <div className="w-[88vw] max-w-3xl rounded-3xl bg-white p-6 text-slate-800">
        <p className="text-sm text-slate-500">Loading room details...</p>
      </div>
    )
  }

  const gallery = roomData.otherImageUrls.length ? roomData.otherImageUrls : [roomData.mainImageUrl]
  const activeImage = gallery[currentImageIndex] || roomData.mainImageUrl

  return (
    <div className="w-[90vw] max-w-4xl rounded-3xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-slate-900">{roomData.name || 'Room'}</h3>
        <button onClick={onClose} className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">
          Close
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div>
          {activeImage ? (
            <img
              alt="Room view"
              className="h-72 w-full rounded-2xl object-cover"
              src={activeImage}
            />
          ) : (
            <div className="flex h-72 w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              No image available
            </div>
          )}
          {gallery.length > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <button className="rounded-lg border border-slate-200 px-3 py-1 text-sm" onClick={handlePrevImage}>
                Prev
              </button>
              <div className="mx-3 flex flex-1 gap-2 overflow-x-auto">
                {gallery.map((imageUrl, index) => (
                  <img
                    key={index}
                    alt={`Room view ${index + 1}`}
                    className={`h-16 w-20 flex-none cursor-pointer rounded-lg object-cover ${
                      index === currentImageIndex ? 'ring-2 ring-[#00773d]' : ''
                    }`}
                    src={imageUrl}
                    onClick={() => setCurrentImageIndex(index)}
                  />
                ))}
              </div>
              <button className="rounded-lg border border-slate-200 px-3 py-1 text-sm" onClick={handleNextImage}>
                Next
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <p>{roomData.description}</p>
          <p>
            <span className="font-semibold text-slate-900">Size:</span> {roomData.size || 'N/A'}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Reviews:</span> {roomData.reviews || 'N/A'}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Smoking:</span>{' '}
            {roomData.smoking ? 'Allowed' : 'Not allowed'}
          </p>

          <div>
            <h4 className="mb-1 font-semibold text-slate-900">Facilities</h4>
            <ul className="list-disc space-y-1 pl-5">
              {roomData.facilities.map((facility, index) => (
                <li key={index}>{facility}</li>
              ))}
              {roomData.facilities.length === 0 && <li>No facilities listed.</li>}
            </ul>
          </div>

          <div>
            <h4 className="mb-1 font-semibold text-slate-900">Bathroom</h4>
            <ul className="list-disc space-y-1 pl-5">
              {roomData.sharedBathroom.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
              {roomData.sharedBathroom.length === 0 && <li>No details listed.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RoomDetails
