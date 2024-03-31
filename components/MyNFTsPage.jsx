import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getOwnedTokens } from '@/services/blockchain'
import { useAccount } from 'wagmi'

const NFTList = () => {
  const [tokens, setTokens] = useState([])
  const { address: walletAddress } = useAccount()

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
              className="w-full h-40 object-cover rounded-md"
              whileHover={{ scale: 1.05 }}
            />
            <p className="text-sm mb-2">Name: {token.name}</p>
            <p className="text-sm mb-2">Description: {token.description}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

export default NFTList
