import { ethers } from 'ethers'
import { getChainConfig } from '@/config/chains'
import { normalizeIpfsUrl } from '@/utils/helper'

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 80002)
const LEGACY_ABI = [
  'function getApartments() view returns ((uint256 id,string name,string description,string longitude,string images,uint256 rooms,address owner,bool deleted,uint256 timestamp,string location,string latitude,string pinataJsonLink,string nftName,string nftDescription,string nftImageUrl)[])',
  'function getBookings(uint256) view returns ((uint256 id,uint256 aid,address tenant,uint256 roomTypeIndex,uint256 roomsBooked,uint256[] dates,uint256 pricePerNight,uint256 totalPrice,uint256 tokenId,uint256 apartmentTokenId,uint8 status,uint256 timestamp)[])',
  'function getOwnedTokens(address) view returns ((uint256 id,string metadataUri)[])',
]

function legacyContract() {
  const chain = getChainConfig(CHAIN_ID)
  if (!chain.legacyV1Address) throw new Error(`Legacy V1 is not configured on ${chain.name}`)
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.id, { staticNetwork: true })
  return new ethers.Contract(chain.legacyV1Address, LEGACY_ABI, provider)
}

export async function getLegacyListings() {
  const apartments = await legacyContract().getApartments()
  return apartments.map((apartment) => ({
    id: Number(apartment.id),
    name: apartment.name,
    owner: apartment.owner,
    description: apartment.description,
    location: apartment.location,
    deleted: apartment.deleted,
    images: apartment.images.split(',').filter(Boolean).map(normalizeIpfsUrl),
    rooms: Number(apartment.rooms),
    timestamp: Number(apartment.timestamp),
  }))
}

export async function getLegacyGuestBookings(owner) {
  if (!owner) return []
  const contract = legacyContract()
  const listings = await contract.getApartments()
  const pages = await Promise.all(listings.map((listing) => contract.getBookings(listing.id)))
  return pages
    .flat()
    .filter((booking) => booking.tenant.toLowerCase() === owner.toLowerCase())
    .map((booking) => ({
      id: Number(booking.id),
      aid: Number(booking.aid),
      tenant: booking.tenant,
      dates: booking.dates.map(Number),
      status: Number(booking.status),
      tokenId: Number(booking.tokenId),
    }))
}

export async function getLegacyOwnedTokens(owner) {
  if (!owner) return []
  const tokens = await legacyContract().getOwnedTokens(owner)
  return tokens.map((token) => ({ id: Number(token.id), metadataUri: token.metadataUri }))
}
