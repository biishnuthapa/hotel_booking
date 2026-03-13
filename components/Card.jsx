import React from 'react'
import Link from 'next/link'
import { ImageSlider } from '.'
import { FaStar } from 'react-icons/fa'
import { formatDate } from '@/utils/helper'

const Card = ({ appartment }) => {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={'/room/' + appartment.id}>
        <ImageSlider images={appartment.images} />
      </Link>
      <div className="space-y-2 px-4 py-4">
        <div className="flex items-start justify-between">
          <p className="text-base font-semibold capitalize text-slate-900">{appartment.name}</p>
          <p className="flex items-center justify-start space-x-2 text-xs font-medium text-slate-500">
            <FaStar />
            <span>New</span>
          </p>
        </div>
        <p className="text-sm text-slate-500">{appartment.location}</p>
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-500">{formatDate(appartment.timestamp)}</p>
          <b className="flex items-center justify-start space-x-1 font-semibold text-[#00773d]">
            {appartment.price > 0 ? (
              <span>From {appartment.price} ETH / night</span>
            ) : (
              <span>Price unavailable</span>
            )}
          </b>
        </div>
      </div>
    </div>
  )
}

export default Card
