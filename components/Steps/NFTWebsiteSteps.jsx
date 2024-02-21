import React from 'react';

const NFTWebsiteSteps = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-center text-green-600 mb-8 leading-tight pt-5">How It Works</h1>
      <div className="max-w-screen-xl mx-auto">
        <div className="flex flex-wrap justify-center gap-10 my-14">
          {/* Step 1 */}
          <div className="w-72 p-6 border rounded-lg shadow-md transition-transform transform hover:scale-105">
            <img src="/assets/steps1.jpeg" alt="Connect Wallet" className="rounded-full mx-auto mb-5" />
            <h2 className="text-2xl font-semibold text-center">Connect Your Wallet</h2>
            <p className="text-gray-600 text-center">Connect your cryptocurrency wallet to get started.</p>
          </div>

          {/* Step 2 */}
          <div className="w-72 p-6 border rounded-lg shadow-md transition-transform transform hover:scale-105">
            <img src="/assets/steps2.jpeg" alt="Search Stays" className="rounded-full mx-auto mb-5" />
            <h2 className="text-2xl font-semibold text-center">Search Your Stays</h2>
            <p className="text-gray-600 text-center">Find available stays or hotels to book.</p>
          </div>

          {/* Step 3 */}
          <div className="w-72 p-6 border rounded-lg shadow-md transition-transform transform hover:scale-105">
            <img src="/assets/steps3.jpeg" alt="Make Purchase" className="rounded-full mx-auto mb-5" />
            <h2 className="text-2xl font-semibold text-center">Make Purchase as NFT</h2>
            <p className="text-gray-600 text-center">Purchase the hotel booking as an NFT.</p>
          </div>

          {/* Step 4 */}
          <div className="w-72 p-6 border rounded-lg shadow-md transition-transform transform hover:scale-105">
            <img src="/assets/steps4.jpeg" alt="Stay or Resell" className="rounded-full mx-auto mb-5" />
            <h2 className="text-2xl font-semibold text-center">Stay or Resell</h2>
            <p className="text-gray-600 text-center">Enjoy your stay or consider reselling the NFT.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFTWebsiteSteps;
