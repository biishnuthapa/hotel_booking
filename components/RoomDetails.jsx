import React, { useState } from 'react'

const RoomDetails = ({ onClose, room }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  if (!room) {
    return (
      <div className="w-[88vw] max-w-3xl rounded-3xl bg-white p-6 text-slate-800">
        <p className="text-sm text-slate-500">Loading room details...</p>
      </div>
    )
  }

  const gallery = room.images || []

  const handlePrevImage = () => {
    if (!gallery.length) return
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? gallery.length - 1 : prevIndex - 1
    )
  }

  const handleNextImage = () => {
    if (!gallery.length) return
    setCurrentImageIndex((prevIndex) =>
      prevIndex === gallery.length - 1 ? 0 : prevIndex + 1
    )
  }

  const activeImage = gallery[currentImageIndex]

  return (
    <div className="w-[90vw] max-w-4xl rounded-3xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-slate-900">{room.name || 'Room'}</h3>
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
          <p>{room.description}</p>
        </div>
      </div>
    </div>
  )
}

export default RoomDetails
