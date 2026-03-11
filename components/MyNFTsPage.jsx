import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getOwnedTokens } from '@/services/blockchain'
import { useAccount } from 'wagmi'
import Modal from 'react-modal'
import { normalizeIpfsUrl } from '@/utils/helper'

const NFTList = () => {
  const [tokens, setTokens] = useState([])
  const { address: walletAddress } = useAccount()
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    const fetchTokens = async () => {
      if (!walletAddress) {
        setTokens([])
        return
      }

      try {
        const ownedTokens = await getOwnedTokens(walletAddress)
        const tokensWithMetadata = await Promise.all(
          ownedTokens.map(async (token) => {
            try {
              let metadata = null
              const uri = token.metadataUri || ''
              if (uri.startsWith('data:application/json;base64,')) {
                const base64 = uri.replace('data:application/json;base64,', '')
                metadata = JSON.parse(atob(base64))
              } else {
                const metadataResponse = await fetch(normalizeIpfsUrl(uri))
                metadata = await metadataResponse.json()
              }
              return {
                ...token,
                name: metadata.name || `Hospitality NFT #${token.id}`,
                description: metadata.description || token.metadataUri,
                image: normalizeIpfsUrl(metadata.image),
              }
            } catch (metadataError) {
              console.warn(`Failed to load metadata for token ${token.id}:`, metadataError)
              return {
                ...token,
                name: `Hospitality NFT #${token.id}`,
                description: token.metadataUri,
                image: '',
              }
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

  const openModal = (image) => setSelectedImage(image)
  const closeModal = () => setSelectedImage(null)

  return (
    <div>
      {tokens.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
          You have no NFTs minted on your account yet.
        </p>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tokens.map((token) => (
          <motion.li
            key={token.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <strong className="mb-2 block text-sm font-semibold text-slate-700">Token #{token.id}</strong>
            {token.image ? (
              <img
                src={token.image}
                alt={token.name}
                className="h-56 w-full cursor-pointer rounded-xl object-cover"
                onClick={() => openModal(token.image)}
              />
            ) : (
              <div className="flex h-56 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                Metadata image unavailable
              </div>
            )}
            <p className="mt-3 text-base font-semibold text-slate-900">{token.name}</p>
            <p className="mt-1 text-sm text-slate-600">{token.description}</p>
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
            width: 'min(90vw, 900px)',
            maxHeight: '90vh',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
          },
        }}
      >
        <img src={selectedImage || ''} alt="NFT preview" className="mx-auto max-h-[70vh] w-full rounded-xl object-contain" />
        <button
          onClick={closeModal}
          className="mx-auto mt-4 block rounded-xl bg-[#00773d] px-4 py-2 text-sm font-semibold text-white"
        >
          Close
        </button>
      </Modal>
    </div>
  )
}

export default NFTList
