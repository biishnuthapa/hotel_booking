import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getOwnedTokens } from '@/services/blockchain'
import { useAccount } from 'wagmi'
import Modal from 'react-modal'

const NFTList = () => {
  const [tokens, setTokens] = useState([])
  const { address: walletAddress } = useAccount()
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const ownedTokens = await getOwnedTokens(walletAddress)
        const tokensWithMetadata = await Promise.all(
          ownedTokens.map(async (token) => {
            const metadataResponse = await fetch(token.metadataUri)
            const metadata = await metadataResponse.json()
            return {
              ...token,
              name: metadata.name,
              description: metadata.description,
              image: metadata.image,
            }
          })
        )
        setTokens(tokensWithMetadata)
      } catch (error) {
        console.error('Error fetching tokens or metadata:', error)
      }
    }

    fetchTokens()
  }, [walletAddress])

  const openModal = (image) => {
    setSelectedImage(image)
  }

  const closeModal = () => {
    setSelectedImage(null)
  }

  return (
    <div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tokens.map((token) => (
          <motion.li
            key={token.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-lg shadow-md p-4"
          >
            <strong className="block text-lg font-bold mb-2">ID: {token.id}</strong>
            <img
              src={token.image}
              alt={token.name}
              className="w-full h-60 object-cover rounded-md cursor-pointer"
              onClick={() => openModal(token.image)}
              whileHover={{ scale: 1.05 }}
            />
            <p className="text-sm mb-2">Name: {token.name}</p>
            <p className="text-sm mb-2">Description: {token.description}</p>
          </motion.li>
        ))}
      </ul>
      <Modal
        isOpen={selectedImage !== null}
        onRequestClose={closeModal}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxHeight: '80%',
            overflow: 'hidden',
            backgroundColor: 'transparent',
            border: 'none',
          },
        }}
      >
        <img src={selectedImage} alt="Full size" className="mx-auto max-w-full max-h-80vh" />
        <button
          onClick={closeModal}
          className="block mx-auto mt-4 px-4 py-2 bg-green-600 text-white rounded-md cursor-pointer"
        >
          Close
        </button>
      </Modal>
    </div>
  )
}

export default NFTList
