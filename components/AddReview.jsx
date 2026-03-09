import { useState } from 'react'
import { toast } from 'react-toastify'
import { FaTimes } from 'react-icons/fa'
import { addReview } from '@/services/blockchain'
import { globalActions } from '@/store/globalSlices'
import { useDispatch, useSelector } from 'react-redux'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const AddReview = ({ roomId }) => {
  const [reviewText, setReviewText] = useState('')
  const dispatch = useDispatch()

  const { setReviewModal } = globalActions
  const { reviewModal } = useSelector((states) => states.globalStates)

  const resetForm = () => {
    setReviewText('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!reviewText.trim()) return

    toast.promise(
      new Promise((resolve, reject) => {
        addReview(roomId, reviewText.trim())
          .then((tx) => {
            dispatch(setReviewModal('scale-0'))
            resetForm()
            resolve(tx)
          })
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Review submitted successfully.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  return (
    <div
      className={`fixed left-0 top-0 z-[3000] flex h-screen w-screen items-center justify-center bg-black/60 transition-transform duration-300 ${reviewModal}`}
    >
      <div className="w-11/12 rounded-3xl bg-white p-6 shadow-2xl md:w-2/5">
        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900">Share your stay feedback</p>
            <button
              type="button"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
              onClick={() => dispatch(setReviewModal('scale-0'))}
            >
              <FaTimes />
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <textarea
              className="block h-28 w-full resize-none border-0 bg-transparent text-sm text-slate-700 outline-none"
              name="comment"
              placeholder="Write your review..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-[#00773d] py-3 font-semibold text-white transition hover:brightness-110"
          >
            Submit Review
          </button>
        </form>
      </div>
    </div>
  )
}

export default AddReview
