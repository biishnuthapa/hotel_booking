import Identicon from 'react-identicons'
import { formatDate, truncate } from '@/utils/helper'

const Review = ({ review }) => {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center space-x-2">
        <Identicon
          string={review.owner}
          size={20}
          className="rounded-full shadow-gray-500 shadow-sm"
        />
        <div className="flex items-center justify-start space-x-2">
          <p className="text-md font-semibold text-slate-900">{truncate(review.owner, 4, 4, 11)} </p>
          <p className="text-sm text-slate-500">{formatDate(review.timestamp)}</p>
        </div>
      </div>
      <p className="text-sm text-slate-600">{review.text}</p>
    </div>
  )
}

export default Review
