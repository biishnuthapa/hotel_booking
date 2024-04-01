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
    <div className="py-5 border-b-2 border-b-slate-200 space-y-4">
      <h1 className="text-xl font-semibold">Description</h1>
      <p className="text-slate-500 text-lg w-full sm:w-4/5 leading-8 text-justify">
        {apartment?.description}
      </p>

      <div className="flex space-x-4">
        <BiBookOpen className="text-4xl" />
        <div>
          <h1 className="text-xl font-semibold">Booking Open 24 Hrs</h1>
        </div>
      </div>

      <div className=" flex space-x-4 ">
        <FiMapPin className="text-4xl" />
        <div>
          <h1 className="text-xl font-semibold">Location</h1>
          <p className="cursor-pointer">{apartment?.location}</p>
        </div>
      </div>

      <div className=" flex space-x-4">
        <FiCalendar className="text-4xl" />
        <div>
          {/* Display dynamic cancellation date */}
          <h1 className="text-xl font-semibold">
            Free cancellation before {formattedCancellationDate}
          </h1>
        </div>
      </div>
    </div>
  )
}

export default Description
