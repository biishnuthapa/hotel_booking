import { useEffect, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import { normalizeIpfsUrl, truncate } from '@/utils/helper'
import { toast } from 'react-toastify'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { createApartment } from '@/services/blockchain'
import { pinNftMetadata } from '@/services/pinata'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

export default function AddApartmentPage() {
  const { address } = useAccount()
  const navigate = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [rooms, setRooms] = useState('')
  const [images, setImages] = useState('')
  const [links, setLinks] = useState([])
  const [pinataJsonLink, setPinataJsonLink] = useState('')
  const [metadataPreview, setMetadataPreview] = useState(null)
  const [metadataError, setMetadataError] = useState('')
  const [metadataLoading, setMetadataLoading] = useState(false)

  const [nftImageFile, setNftImageFile] = useState(null)
  const [nftImagePreview, setNftImagePreview] = useState('')
  const [pinning, setPinning] = useState(false)

  const onNftImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    setNftImageFile(file)
    setNftImagePreview(URL.createObjectURL(file))
  }

  const handlePinNft = async () => {
    if (!name.trim() || !description.trim()) {
      toast.error('Fill in the property name and description first — they become the NFT name and description.')
      return
    }
    if (!nftImageFile) {
      toast.error('Choose an NFT image to upload.')
      return
    }
    setPinning(true)
    try {
      const result = await pinNftMetadata({
        image: nftImageFile,
        name: name.trim(),
        description: description.trim(),
      })
      setPinataJsonLink(result.uri) // ipfs://<metadata-cid>; preview effect resolves it
      toast.success('NFT image + metadata pinned to IPFS.')
    } catch (error) {
      const msg = error?.response?.data?.error || error?.message || 'Pinning failed'
      toast.error(msg)
    } finally {
      setPinning(false)
    }
  }

  useEffect(() => {
    const trimmed = pinataJsonLink.trim()
    if (!trimmed) {
      setMetadataPreview(null)
      setMetadataError('')
      setMetadataLoading(false)
      return
    }

    const controller = new AbortController()
    const fetchMetadata = async () => {
      setMetadataLoading(true)
      setMetadataError('')
      try {
        const response = await fetch(normalizeIpfsUrl(trimmed), { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Metadata request failed with ${response.status}`)
        }
        const metadata = await response.json()
        setMetadataPreview({
          name: typeof metadata?.name === 'string' ? metadata.name.trim() : '',
          description: typeof metadata?.description === 'string' ? metadata.description.trim() : '',
          image: normalizeIpfsUrl(metadata?.image || ''),
        })
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setMetadataPreview(null)
          setMetadataError('Unable to load metadata. Check the JSON link.')
        }
      } finally {
        setMetadataLoading(false)
      }
    }

    fetchMetadata()
    return () => controller.abort()
  }, [pinataJsonLink])

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!name || !location || !description || !rooms || links.length !== 5 || !pinataJsonLink || !latitude || !longitude) {
      toast.error('Please complete all fields, provide 5 property images, and add the NFT metadata link.')
      return
    }

    if (!metadataPreview?.image || !metadataPreview?.name || !metadataPreview?.description) {
      toast.error('Please provide a valid Pinata JSON link with name, description, and image.')
      return
    }

    const params = {
      name: name.trim(),
      description: description.trim(),
      location: location.trim(),
      rooms: Number(rooms),
      images: links.slice(0, 5).join(','),
      latitude: latitude.trim(),
      longitude: longitude.trim(),
      pinataJsonLink: pinataJsonLink.trim(),
      nftName: metadataPreview.name.trim(),
      nftDescription: metadataPreview.description.trim(),
      nftImageUrl: metadataPreview.image.trim(),
    }

    toast.promise(
      new Promise((resolve, reject) => {
        createApartment(params)
          .then(() => {
            navigate.push('/')
            resolve()
          })
          .catch((error) => reject(error))
      }),
      {
        pending: 'Approve transaction...',
        success: 'Apartment added successfully.',
        error: {
          render({ data }) {
            return formatToastError(data)
          },
        },
      }
    )
  }

  const addImage = () => {
    if (!images.trim()) return
    if (links.length !== 5) setLinks((prevState) => [...prevState, images.trim()])
    setImages('')
  }

  const removeImage = (index) => {
    links.splice(index, 1)
    setLinks(() => [...links])
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-2xl font-semibold text-slate-900">List a New Property</h1>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <input
            className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="text"
            placeholder="Property Name"
            onChange={(e) => setName(e.target.value)}
            value={name}
            required
          />

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
              type="url"
              placeholder="Image URL"
              onChange={(e) => setImages(e.target.value)}
              value={images}
            />
            {links.length !== 5 && (
              <button
                onClick={addImage}
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Add
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                <span>{truncate(link, 6, 8, 22)}</span>
                <button onClick={() => removeImage(i)} type="button" className="text-slate-500">
                  <FaTimes />
                </button>
              </div>
            ))}
          </div>

          <input
            className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="text"
            placeholder="Location"
            onChange={(e) => setLocation(e.target.value)}
            value={location}
            required
          />
          <input
            className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="number"
            min={1}
            placeholder="Number of rooms"
            onChange={(e) => setRooms(e.target.value)}
            value={rooms}
            required
          />
          <textarea
            className="h-28 rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            placeholder="Description"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
            required
          />
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
              type="text"
              placeholder="Latitude"
              onChange={(e) => setLatitude(e.target.value)}
              value={latitude}
              required
            />
            <input
              className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
              type="text"
              placeholder="Longitude"
              onChange={(e) => setLongitude(e.target.value)}
              value={longitude}
              required
            />
          </div>
          <div className="rounded-2xl border border-dashed border-[#00773d]/40 bg-[#00773d]/5 p-4">
            <p className="mb-1 text-sm font-semibold text-slate-800">NFT check-in pass image</p>
            <p className="mb-3 text-xs text-slate-500">
              Upload an image and we&apos;ll pin it plus the metadata JSON to IPFS via Pinata, then
              auto-fill the link below. Uses the property name and description above.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/*"
                onChange={onNftImageChange}
                className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {nftImagePreview && (
                <img
                  src={nftImagePreview}
                  alt="NFT preview"
                  className="h-16 w-16 rounded-xl object-cover"
                />
              )}
              <button
                type="button"
                onClick={handlePinNft}
                disabled={pinning}
                className={`rounded-xl bg-[#00773d] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 sm:ml-auto ${
                  pinning ? 'cursor-not-allowed opacity-60' : ''
                }`}
              >
                {pinning ? 'Pinning to IPFS…' : 'Pin NFT to IPFS'}
              </button>
            </div>
          </div>

          <input
            className="rounded-xl border border-slate-300 p-3 outline-none focus:border-[#00773d]"
            type="url"
            placeholder="NFT Metadata JSON URL (auto-filled after pinning, or paste your own)"
            onChange={(e) => setPinataJsonLink(e.target.value)}
            value={pinataJsonLink}
            required
          />
          <p className="text-xs text-slate-500">
            This JSON controls the NFT image, name, and description. The NFT will use the image from this link.
          </p>
          {(metadataLoading || metadataError || metadataPreview) && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {metadataLoading && <p className="text-sm text-slate-600">Loading metadata preview...</p>}
              {metadataError && <p className="text-sm text-rose-600">{metadataError}</p>}
              {metadataPreview && !metadataLoading && !metadataError && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {metadataPreview.image ? (
                    <img
                      src={metadataPreview.image}
                      alt={metadataPreview.name || 'NFT preview'}
                      className="h-28 w-28 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-slate-200 text-xs text-slate-600">
                      No image
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {metadataPreview.name || 'Missing name'}
                    </p>
                    <p className="text-xs text-slate-600">
                      {metadataPreview.description || 'Missing description'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className={`rounded-xl bg-[#00773d] py-3 font-semibold text-white transition hover:brightness-110 ${
              !address ? 'cursor-not-allowed opacity-50' : ''
            }`}
            disabled={!address}
          >
            Add Property
          </button>
        </form>
      </div>
    </div>
  )
}
