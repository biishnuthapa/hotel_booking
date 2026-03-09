import { BiBookOpen } from 'react-icons/bi'
import { FiCalendar, FiMapPin } from 'react-icons/fi'

const Description = ({ apartment }) => {
  // Get the current date
  const currentDate = new Date()
  // Add 2 days to the current date
  const cancellationDate = new Date(currentDate)
  cancellationDate.setDate(cancellationDate.getDate() + 2)

  // Format the cancellation date as "Month Day, Year"
  const formattedCancellationDate = cancellationDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Description</h1>
      <p className="w-full leading-8 text-slate-600 sm:w-4/5">
        {apartment?.description}
      </p>

      <div className="flex space-x-4">
        <BiBookOpen className="text-3xl text-[#00773d]" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Booking Open 24/7</h1>
        </div>
      </div>

      <div className="flex space-x-4">
        <FiMapPin className="text-3xl text-[#00773d]" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Location</h1>
          <p className="text-slate-600">{apartment?.location}</p>
        </div>
      </div>

      <div className="flex space-x-4">
        <FiCalendar className="text-3xl text-[#00773d]" />
        <div>
          {/* Display dynamic cancellation date */}
          <h1 className="text-lg font-semibold text-slate-900">
            Free cancellation before {formattedCancellationDate}
          </h1>
        </div>
      </div>
    </div>
  )
}

export default Description
