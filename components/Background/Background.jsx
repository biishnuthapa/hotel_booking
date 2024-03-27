import React, { useState, useEffect } from 'react';
import Image from 'next/image'; // Import the Image component from next/image

const Background = ({ images }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Function to handle sliding to the next image
  const nextSlide = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  };

  // Disable ESLint rule for unused variable
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const prevSlide = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

  // Automatically slide to the next image every 5 seconds
  useEffect(() => {
    const slideInterval = setInterval(nextSlide, 5000);
    return () => clearInterval(slideInterval);
  }, []);

  // Function to handle clicking on a slider bubble
  const handleBubbleClick = (index) => {
    setCurrentImageIndex(index);
  };

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Slider images */}
      {images.map((image, index) => (
        <Image
          key={index}
          src={image}
          alt={`Slide ${index}`}
          layout="fill" // Ensure the image fills its container
          objectFit="cover" // Maintain aspect ratio and cover the container
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentImageIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* Slider bubbles */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => handleBubbleClick(index)} // Call handleBubbleClick when clicked
            className={`w-4 h-4 rounded-full ${
              index === currentImageIndex ? 'bg-[#00773d]' : 'bg-white'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Background;