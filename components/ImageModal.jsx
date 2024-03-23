import React from 'react'

const ImageModal = ({ images, onClose }) => {
  return (
    <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-75 z-50">
      <div className="bg-white p-8 rounded-lg max-w-lg overflow-auto">
        <button
          className="absolute top-4 right-4 text-gray-700 hover:text-gray-900"
          onClick={onClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
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
        </button>
        <div className="grid grid-cols-3 gap-4">
          {images.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Room Image ${index + 1}`}
              className="w-full h-auto"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ImageModal
