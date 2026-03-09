import React, { useState } from 'react'
import Lightbox from 'react-image-lightbox'
import 'react-image-lightbox/style.css'
import { normalizeIpfsUrl } from '@/utils/helper'

const ImageGrid = ({ first, second, third, forth, fifth }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const images = [first, second, third, forth, fifth].map((img) => normalizeIpfsUrl(img)).filter(Boolean)

  if (images.length === 0) return null

  const openLightbox = (index) => {
    setPhotoIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div className="mt-2 grid gap-2 md:grid-cols-[1.3fr_1fr]">
      <div className="overflow-hidden rounded-2xl">
        <img
          className="h-[22rem] w-full cursor-pointer object-cover"
          src={images[0]}
          alt="Apartment image"
          onClick={() => openLightbox(0)}
        />
      </div>
      <div className="hidden grid-cols-2 gap-2 md:grid">
        {images.slice(1, 5).map((image, index) => (
          <img
            key={index}
            src={image}
            alt={`Apartment image ${index + 2}`}
            className="h-[10.9rem] w-full cursor-pointer rounded-2xl object-cover"
            onClick={() => openLightbox(index + 1)}
          />
        ))}
      </div>
      {lightboxOpen && (
        <Lightbox
          mainSrc={images[photoIndex]}
          nextSrc={images[(photoIndex + 1) % images.length]}
          prevSrc={images[(photoIndex + images.length - 1) % images.length]}
          onCloseRequest={() => setLightboxOpen(false)}
          onMovePrevRequest={() => setPhotoIndex((photoIndex + images.length - 1) % images.length)}
          onMoveNextRequest={() => setPhotoIndex((photoIndex + 1) % images.length)}
        />
      )}
    </div>
  )
}

export default ImageGrid
