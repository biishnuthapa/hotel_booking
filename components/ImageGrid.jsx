import React, { useState } from 'react';
import Lightbox from 'react-image-lightbox';
import 'react-image-lightbox/style.css';

const ImageGrid = ({ first, second, third, forth, fifth }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const images = [first, second, third, forth, fifth];

  const openLightbox = (index) => {
    setPhotoIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="mt-8 h-[32rem] flex rounded-2xl overflow-hidden">
      <div className="md:w-1/2 w-full overflow-hidden">
        <img
          className="object-cover w-full h-full cursor-pointer"
          src={first}
          onClick={() => openLightbox(0)}
        />
      </div>
      <div className="w-1/2 md:flex hidden flex-wrap">
        {images.slice(1).map((image, index) => (
          <img
            key={index}
            src={image}
            alt=""
            className="object-cover w-1/2 h-64 pl-2 pb-1 pr-1 cursor-pointer"
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
          onMovePrevRequest={() =>
            setPhotoIndex((photoIndex + images.length - 1) % images.length)
          }
          onMoveNextRequest={() =>
            setPhotoIndex((photoIndex + 1) % images.length)
          }
        />
      )}
    </div>
  );
};

export default ImageGrid;
