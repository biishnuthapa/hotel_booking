import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTwitter, faFacebook, faInstagram } from '@fortawesome/free-brands-svg-icons';

const Information = () => {
  return (
    <footer className="bg-gray-100 text-gray-800 py-10 px-10 "> 
      <div className="container mx-auto flex flex-wrap justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-green-600">Hospitality NFT</h1>
          <p className="text-lg mb-6">Marketplace for Tokenized Travel Assets</p>
          <p className="text-base mb-2">BOOK, TRADE, RESELL HOTEL ROOMS WITH CRYPTO OR FIAT</p>
          <p className="text-base mb-2">Be early, get rewarded</p>
          <p className="text-base mb-2">Rewards could drop even from thin Air!</p>
          <p className="text-base">Don't Cancel, Resell</p>
        </div>

        <div>
          <h1 className="text-lg font-semibold mb-4 text-green-600">Contact Us</h1>
          <p className="text-base mb-2">Rem.work, Kamalpokhari, Nepal</p>
          <p className="text-base mb-2">admin@koion.tech</p>
          <p className="text-base">123-456-7890</p>
        </div>

        <div>
          <h1 className="text-lg font-semibold mb-4 text-green-600">Follow Us</h1>
          <div className="flex items-center space-x-4">
            <a href="#" className="text-gray-800">
              <FontAwesomeIcon icon={faFacebook} className="text-2xl" />
            </a>
            <a href="#" className="text-gray-800">
              <FontAwesomeIcon icon={faTwitter} className="text-2xl" />
            </a>
            <a href="#" className="text-gray-800">
              <FontAwesomeIcon icon={faInstagram} className="text-2xl" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Information;
