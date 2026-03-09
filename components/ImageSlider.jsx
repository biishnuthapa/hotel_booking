import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination, Navigation } from 'swiper'
import { normalizeIpfsUrl } from '@/utils/helper'

const ImageSlider = ({ images }) => {
  return (
    <Swiper
      spaceBetween={30}
      centeredSlides={true}
      autoplay={{
        delay: 2500,
        disableOnInteraction: false,
      }}
      pagination={{
        clickable: true,
      }}
      navigation={false}
      modules={[Autoplay, Pagination, Navigation]}
      className="h-56 w-full overflow-hidden"
    >
      {images.map((url, i) => (
        <SwiperSlide key={i}>
          <SlideImage src={url} alt={'image slide ' + i} />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

const SlideImage = ({ src, alt }) => {
  const normalizedSrc = normalizeIpfsUrl(src)

  return (
    <div className="w-full h-full relative">
      <Image src={normalizedSrc} alt={alt} fill objectFit="cover" sizes="100vw" />
    </div>
  )
}

export default ImageSlider
