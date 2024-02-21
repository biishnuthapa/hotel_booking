import React, { useState, useEffect } from 'react'

const Background = ({ images }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Function to handle sliding to the next image
  const nextSlide = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1))
  }

  // Function to handle sliding to the previous image
  const prevSlide = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1))
  }

  // Automatically slide to the next image every 5 seconds
  const slideShow = () => {
    setInterval(nextSlide, 2500)
  }

  // Start the slideshow when the component mounts
  useEffect(() => {
    slideShow()
  }, [])

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Slider images */}
      {images.map((image, index) => (
        <img
          key={index}
          src={image}
          alt={`Slide ${index}`}
          className={`absolute inset-0 object-cover w-full h-full transition-opacity duration-1000 ${
            index === currentImageIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* Slider bubbles */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentImageIndex(index)}
            className={`w-4 h-4 rounded-full ${
              index === currentImageIndex ? 'bg-[#00773d]' : 'bg-white'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default Background
