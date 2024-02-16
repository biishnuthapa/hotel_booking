import React, { useState } from 'react';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const questions = [
    {
      question: 'What is Hospitality NFT?',
      answer:
        'Hospitality NFT is a type of non-fungible token (NFT) that represents ownership of a right or access to a hospitality-related service or product. This could include things like hotel stays, airline tickets, or event tickets.',
    },
    {
      question: 'What are NFTs?',
      answer:
        'NFTs are unique digital assets that are stored on a blockchain. They can be used to represent ownership of a wide variety of things, including art, music, collectibles, and even real estate.',
    },
    {
      question: 'How do I get NFTs?',
      answer:
        'There are a few different ways to get NFTs. You can buy them on marketplaces like OpenSea or Rarible, or you can earn them by participating in play-to-earn games or completing other tasks.',
    },
    {
      question: 'How do I send feedback?',
      answer:
        'You can send feedback to our team by emailing us at feedback@hospitalitynft.com.',
    },
  ];

  const handleToggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="bg-gray-100 py-16">
      <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold text-center text-green-600 mb-8 leading-tight">Frequently Asked Questions</h1>
        <div className="grid gap-6">
          {questions.map((question, index) => (
            <div key={index} className="border border-gray-300 rounded-lg overflow-hidden shadow-md">
              <button
                className="flex items-center justify-between bg-white w-full px-6 py-4 focus:outline-none"
                onClick={() => handleToggle(index)}
              >
                <h3 className="text-xl text-black font-medium">{question.question}</h3>
                <svg
                  className={`w-6 h-6 transition-transform transform ${
                    openIndex === index ? 'rotate-180' : 'rotate-0'
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.293 5.293a1 1 0 011.414 0l5 5a1 1 0 01-1.414 1.414L10 7.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <p className="px-6 py-4 bg-white text-gray-700">{question.answer}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FAQ;
