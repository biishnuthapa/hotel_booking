import React from 'react';
import { useState } from 'react';
import eventsData from '../../data/events.json';

const Upcoming = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const events = eventsData;
  const numEvents = events.length;

  const handleNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === numEvents - 1 ? 0 : prevIndex + 1
    );
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? numEvents - 1 : prevIndex - 1
    );
  };

  return (
    <div className="flex flex-wrap  justify-center items-center py-10  bg-slate-100 ">
      <div className="w-1/3 flex flex-col justify-center items-center">
        <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
        <h3>Secure Your Stay at Upcoming </h3>
        <h3>Blockchain and Tech Events.</h3>
        <div className="flex items-center py-5">
          <button
            className="text-black bg-white border border-zinc-950 focus:outline-none mr-2 bg-transparent hover:text-white hover:bg-green-700 rounded-md p-2"
            onClick={handlePrev}
          >
            &lt;
          </button>
          <button
            className="text-black bg-white border border-zinc-950 focus:outline-none ml-2 bg-transparent hover:text-white hover:bg-green-700 rounded-md p-2"
            onClick={handleNext}
          >
            &gt;
          </button>
        </div>
      </div>
     
        <div className="px-10 grid grid-cols-3 gap-4">
          {events.slice(currentIndex, currentIndex + 3).map((event, index) => (
            <div key={index} className="bg-gray-100 border-2 border-green-700 px-10 py-10 rounded-lg shadow-md">
              <img
                src={event.image}
                alt={event.name}
                className="w-full mb-4 rounded-lg"
              />
              <h3 className="text-xl font-bold mb-2">{event.name}</h3>
              <p className="text-gray-600 mb-2">{event.location}</p>
              <p className="text-gray-600 mb-2">{event.dates}</p>
              <p className="text-gray-800">{event.description}</p>
            </div>
          ))}
        </div>
      </div>
  );
};

export default Upcoming;
