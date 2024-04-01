import React from 'react'

const AddGuests = ({ guestsTitle, category, guestCountAdd, guestCountSub, guestCount }) => {
  return (
    <div className="z-50">
      <div className="grid grid-cols-2 p-5 shadow-md items-center mr-5 mb-2">
        <label htmlFor={category} className="block text-sm font-medium text-gray-700 mr-4">
          {guestsTitle}
        </label>
        <div className="flex items-center space-x-4">
          <span className="text-2xl font-medium">{guestCount}</span>
          <button
            type="button"
            className="px-2 py-1 border border-gray-300 rounded-md font-medium text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none 
                                                focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={guestCountSub}
          >
            -
          </button>
          <button
            type="button"
            className="px-2 py-1 border border-gray-300 rounded-md font-medium text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none 
                                                focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={guestCountAdd}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddGuests
