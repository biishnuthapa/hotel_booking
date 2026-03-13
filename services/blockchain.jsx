import { ethers } from 'ethers'
import { store } from '@/store'
import { globalActions } from '@/store/globalSlices'
import address from '@/contracts/contractAddress.json'
import hospitalityBookingAbi from '@/artifacts/contracts/HospitalityBookingNFT.sol/HospitalityBookingNFT.json'
import { normalizeIpfsUrl } from '@/utils/helper'

const toWei = (num) => ethers.parseEther(num.toString())
const fromWei = (num) => ethers.formatEther(num)

let ethereum, tx
const contractAddress = address.hospitalityBookingContract
const localChainId = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 31337)
const localChainName = localChainId === 31337 ? 'Hardhat Localhost' : 'Localhost'
const localChainHex = `0x${localChainId.toString(16)}`
const localRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'
const isLocalRpc = /127\.0\.0\.1|localhost/.test(localRpcUrl)

if (typeof window !== 'undefined') ethereum = window.ethereum
const { setBookings, setReviews } = globalActions

const isUnknownChainError = (error) => {
  const code = Number(error?.code ?? error?.data?.originalError?.code)
  if (code === 4902) return true
  return /4902/.test(error?.message || '')
}

const ensureLocalChain = async () => {
  if (!ethereum || !isLocalRpc) return

  const currentHex = await ethereum.request({ method: 'eth_chainId' })
  if (currentHex?.toLowerCase() === localChainHex) return

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: localChainHex }],
    })
  } catch (switchError) {
    if (!isUnknownChainError(switchError)) {
      throw switchError
    }

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: localChainHex,
          chainName: localChainName,
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          rpcUrls: [localRpcUrl],
        },
      ],
    })
  }

  const finalHex = await ethereum.request({ method: 'eth_chainId' })
  if (finalHex?.toLowerCase() !== localChainHex) {
    throw new Error(`Please switch MetaMask to ${localChainName} (chainId ${localChainId}).`)
  }
}

const assertContractCode = async (provider) => {
  const code = await provider.getCode(contractAddress)
  if (!code || code === '0x') {
    throw new Error(
      `Contract not found at ${contractAddress} on current RPC. Check NEXT_PUBLIC_RPC_URL and deploy network.`
    )
  }
}

const getRpcProvider = () => new ethers.JsonRpcProvider(localRpcUrl)

const getChainNowSeconds = async () => {
  const provider = getRpcProvider()
  const latestBlock = await provider.getBlock('latest')
  return Number(latestBlock?.timestamp || Math.floor(Date.now() / 1000))
}

const getReadOnlyContract = async () => {
  const provider = getRpcProvider()
  await assertContractCode(provider)
  return new ethers.Contract(contractAddress, hospitalityBookingAbi.abi, provider)
}

const getSignerContract = async () => {
  if (!ethereum) {
    throw new Error('Please install and connect MetaMask')
  }

  await ensureLocalChain()

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
  if (!accounts?.length) {
    throw new Error('No wallet account connected')
  }

  const provider = new ethers.BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  await assertContractCode(provider)
  return new ethers.Contract(contractAddress, hospitalityBookingAbi.abi, signer)
}

const getApartments = async () => {
  const contract = await getReadOnlyContract()
  const apartments = await contract.getApartments()
  return structureAppartments(apartments)
}

export const filterApartmentsByLocation = async (selectedLocation) => {
  const contract = await getReadOnlyContract()
  const apartments = await contract.getApartments()
  return apartments.filter((apartment) => apartment.location === selectedLocation)
}

const getApartment = async (id) => {
  const contract = await getReadOnlyContract()
  const apartment = await contract.getApartment(id)
  return structureAppartments([apartment])[0]
}

const getBookings = async (id) => {
  const contract = await getReadOnlyContract()
  const bookings = await contract.getBookings(id)
  const structured = structuredBookings(bookings)
  let rooms = []
  try {
    rooms = await getRooms(id)
  } catch (error) {
    console.warn('Failed to load rooms for booking decoration:', error)
  }
  const roomNameByIndex = new Map(rooms.map((room) => [Number(room.id), room.name]))
  return structured.map((booking) => ({
    ...booking,
    roomTypeName: roomNameByIndex.get(Number(booking.roomTypeIndex)) || 'Room Type',
  }))
}

const getQualifiedReviewers = async (id) => {
  const contract = await getReadOnlyContract()
  const bookings = await contract.getQualifiedReviewers(id)
  return bookings
}

const getReviews = async (id) => {
  const contract = await getReadOnlyContract()
  const reviewers = await contract.getReviews(id)
  return structuredReviews(reviewers)
}

const getSecurityFee = async () => {
  const contract = await getReadOnlyContract()
  const fee = await contract.securityFee()
  return Number(fee)
}

const createApartment = async (apartment) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    const contract = await getSignerContract()
    tx = await contract.createAppartment(
      apartment.name,
      apartment.description,
      apartment.location,
      apartment.images,
      apartment.rooms,
      apartment.latitude,
      apartment.longitude,
      apartment.pinataJsonLink,
      apartment.nftName,
      apartment.nftDescription,
      apartment.nftImageUrl
    )
    await tx.wait()

    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const updateApartment = async (apartment) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    const contract = await getSignerContract()
    tx = await contract.updateAppartment(
      apartment.id,
      apartment.name,
      apartment.description,
      apartment.location,
      apartment.images,
      apartment.rooms
    )
    await tx.wait()

    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const deleteApartment = async (aid) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    const contract = await getSignerContract()
    tx = await contract.deleteAppartment(aid)
    await tx.wait()

    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const bookApartment = async ({ aid, roomTypeIndex, rooms = 1, timestamps, nightlyPrice, feePercent }) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    if (roomTypeIndex === undefined || roomTypeIndex === null) {
      throw new Error('Please select a room type to book')
    }

    const contract = await getSignerContract()
    const normalizedTimestamps = (timestamps || []).map((timestamp) => {
      const value = Number(timestamp)
      if (!Number.isFinite(value)) return 0
      return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value)
    })

    const validTimestamps = normalizedTimestamps.filter((timestamp) => timestamp > 0)
    const uniqueOrderedTimestamps = Array.from(new Set(validTimestamps)).sort((a, b) => a - b)
    if (uniqueOrderedTimestamps.length === 0) {
      throw new Error('Please select at least one valid booking date')
    }

    const chainNow = await getChainNowSeconds()
    const firstInvalid = uniqueOrderedTimestamps.find((timestamp) => timestamp <= chainNow)
    if (firstInvalid) {
      throw new Error('Selected booking date is not in the future on the current chain clock')
    }

    const roomsRequested = Number(rooms) > 0 ? Number(rooms) : 1
    const basePriceWei = ethers.parseEther(nightlyPrice.toString())
    const totalPriceWei = basePriceWei * BigInt(uniqueOrderedTimestamps.length) * BigInt(roomsRequested)
    const onChainFeePercent = await contract.securityFee()
    const fallbackFeePercent = Number.isFinite(Number(feePercent)) ? BigInt(Number(feePercent)) : 0n
    const appliedFeePercent = onChainFeePercent > 0n ? onChainFeePercent : fallbackFeePercent
    const totalFeeWei = (totalPriceWei * appliedFeePercent) / 100n
    const expectedValue = totalPriceWei + totalFeeWei

    tx = await contract.bookApartment(aid, roomTypeIndex, roomsRequested, uniqueOrderedTimestamps, {
      value: expectedValue,
    })

    await tx.wait()

    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const checkInApartment = async (aid, bookingId) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    const contract = await getSignerContract()
    tx = await contract.checkInApartment(aid, bookingId)

    await tx.wait()
    const bookings = await getBookings(aid)

    store.dispatch(setBookings(bookings))
    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const refundBooking = async (aid, bookingId) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    const contract = await getSignerContract()
    tx = await contract.refundBooking(aid, bookingId)

    await tx.wait()
    const bookings = await getBookings(aid)

    store.dispatch(setBookings(bookings))
    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const addReview = async (aid, comment) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    const contract = await getSignerContract()
    tx = await contract.addReview(aid, comment)

    await tx.wait()
    const reviews = await getReviews(aid)

    store.dispatch(setReviews(reviews))
    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const addRoomTypeToApartment = async (apartmentId, name, description, price, images, capacity) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    const contract = await getSignerContract()
    const tx = await contract.addRoomTypeToApartment(
      apartmentId,
      name,
      description,
      toWei(price),
      images,
      Number(capacity)
    )
    await tx.wait()

    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const deleteRoomType = async (apartmentId, roomTypeIndex) => {
  if (!ethereum) {
    reportError('Please install a browser provider')
    return Promise.reject(new Error('Browser provider not installed'))
  }

  try {
    const contract = await getSignerContract()
    const tx = await contract.deleteRoomType(apartmentId, roomTypeIndex)
    await tx.wait()

    return Promise.resolve(tx)
  } catch (error) {
    reportError(error)
    return Promise.reject(error)
  }
}

const getRooms = async (apartmentId) => {
  const contract = await getReadOnlyContract()
  const rooms = await contract.getRooms(apartmentId)
  return structureRoomTypes(rooms)
}
const structureRoomTypes = (roomTypes) =>
  roomTypes
    .map((roomType, index) => ({
      id: index,
      name: roomType.name,
      description: roomType.description,
      price: fromWei(roomType.price),
      images: roomType.images.split(','),
      capacity: Number(roomType.capacity),
      deleted: roomType.deleted,
    }))
    .filter((roomType) => !roomType.deleted)

const structureAppartments = (appartments) =>
  appartments.map((appartment) => ({
    id: Number(appartment.id),
    name: appartment.name,
    owner: appartment.owner,
    description: appartment.description,
    location: appartment.location,
    deleted: appartment.deleted,
    images: appartment.images.split(',').map((img) => normalizeIpfsUrl(img)),
    rooms: Number(appartment.rooms),
    timestamp: Number(appartment.timestamp),
    latitude: appartment.latitude,
    longitude: appartment.longitude,
    pinataJsonLink: normalizeIpfsUrl(appartment.pinataJsonLink),
    nftName: appartment.nftName,
    nftDescription: appartment.nftDescription,
    nftImageUrl: normalizeIpfsUrl(appartment.nftImageUrl),
  }))

const structuredBookings = (bookings) =>
  bookings.map((booking) => {
    const dates = (booking.dates || []).map((d) => Number(d))
    const checkInDate = dates[0] || 0
    const checkOutDate = dates.length ? dates[dates.length - 1] : 0

    return {
      id: Number(booking.id),
      aid: Number(booking.aid),
      tenant: booking.tenant,
      roomsBooked: Number(booking.roomsBooked || 1),
      dates,
      checkInDate,
      checkOutDate,
      nights: dates.length,
      roomTypeIndex: Number(booking.roomTypeIndex || 0),
      pricePerNight: fromWei(booking.pricePerNight || booking.price || 0),
      totalPrice: fromWei(booking.totalPrice || 0),
      status: Number(booking.status),
      tokenId: Number(booking.tokenId || 0),
      apartmentTokenId: Number(booking.apartmentTokenId || 0),
      checked: Number(booking.status) === 2,
      cancelled: Number(booking.status) === 1,
      timestamp: Number(booking.timestamp),
    }
  })

const structuredReviews = (reviews) =>
  reviews.map((review) => ({
    id: Number(review.id),
    aid: Number(review.aid),
    text: review.reviewText,
    owner: review.owner,
    timestamp: Number(review.timestamp),
  }))

const getOwnedTokens = async (owner) => {
  try {
    if (!owner) return []
    const contract = await getReadOnlyContract()
    const ownedTokens = await contract.getOwnedTokens(owner)
    return ownedTokens.map((token) => ({
      id: Number(token.id),
      metadataUri: token.metadataUri,
    }))
  } catch (error) {
    console.error('Error fetching owned tokens:', error)
    throw error
  }
}

const getMyBookings = async (owner) => {
  if (!owner) return []
  const apartments = await getApartments()
  const ownerLower = owner.toLowerCase()

  const bookingsByApartment = await Promise.all(
    apartments.map(async (apartment) => {
      const bookings = await getBookings(apartment.id)
      return bookings
        .filter((booking) => booking.tenant.toLowerCase() === ownerLower)
        .map((booking) => ({
          ...booking,
          apartmentName: apartment.name,
          apartmentLocation: apartment.location,
        }))
    })
  )

  return bookingsByApartment.flat().sort((a, b) => Number(b.checkInDate) - Number(a.checkInDate))
}

const extractErrorMessage = (error) => {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  return (
    error?.reason ||
    error?.shortMessage ||
    error?.error?.message ||
    error?.data?.message ||
    error?.message ||
    'Unknown error'
  )
}

const reportError = (error) => {
  const message = extractErrorMessage(error)
  console.error('Blockchain call failed:', message, error)
}

export {
  getApartments,
  getApartment,
  getBookings,
  createApartment,
  updateApartment,
  deleteApartment,
  bookApartment,
  checkInApartment,
  refundBooking,
  addReview,
  getReviews,
  getQualifiedReviewers,
  getSecurityFee,
  addRoomTypeToApartment,
  deleteRoomType,
  getRooms,
  getOwnedTokens,
  getMyBookings,
  getChainNowSeconds,
}
