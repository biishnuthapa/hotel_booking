import React, { useEffect, useState } from 'react';

const HeroSection = () => {
   return (
    <div className="relative z-0">
      <div className="container mx-auto px-6 relative z-10 flex items-center justify-center h-full ">
        <div className={`max-w-4xl text-center text-white `}>
          <h1 className="md:text-4xl font-bold mb-2 only:leading-tight">
            Unlock Your Stay: Book with Blockchain & NFTs!
          </h1>
          <p className="text-2xl mb-40">
            Step into the luxury with curated experiences, exclusive access, and unique digital assets. Own a piece of the high life with blockchain-powered ownership.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;


