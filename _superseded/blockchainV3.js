import { ethers } from 'ethers'
import { getChainConfig } from '@/config/chains'
import { validateStayDates } from '@/utils/dates'

export const BOOKING_STATUS = [
  'Booked',
  'Cancelled',
  'CheckedIn',
  'Completed',
  'NoShow',
  'Disputed',
  'ResolvedGuest',
  'ResolvedHost',
]

const V3_ABI = [
  'function paymentToken() view returns (address)',
  'function paymentTokenDecimals() view returns (uint8)',
  'function securityDepositBps() view returns (uint16)',
  'function disputeBondBps() view returns (uint16)',
  'function PAUSER_ROLE() view returns (bytes32)',
  'function ARBITRATOR_ROLE() view returns (bytes32)',
  'function hasRole(bytes32,address) view returns (bool)',
  'function paused() view returns (bool)',
  'function pendingWithdrawals(address) view returns (uint256)',
  'function occupiedRoomsOnDay(uint256,uint32) view returns (uint32)',
  'function isAvailable(uint256,uint32,uint32,uint32) view returns (bool)',
  'function getListingsPage(uint256,uint256) view returns ((uint256 id,address owner,string name,string metadataURI,string imageURI,uint32 totalRooms,uint32 allocatedCapacity,int32 checkInOffsetMinutes,int32 checkOutOffsetMinutes,bool active,uint64 createdAt)[] page,uint256 nextCursor)',
  'function getListing(uint256) view returns ((uint256 id,address owner,string name,string metadataURI,string imageURI,uint32 totalRooms,uint32 allocatedCapacity,int32 checkInOffsetMinutes,int32 checkOutOffsetMinutes,bool active,uint64 createdAt))',
  'function getRoomType(uint256) view returns ((uint256 id,uint256 listingId,string name,string metadataURI,uint256 pricePerNight,uint32 capacity,bool active))',
  'function getBooking(uint256) view returns ((uint256 id,uint256 listingId,uint256 roomTypeId,address host,address guest,uint32 rooms,uint32 checkInDay,uint32 checkOutDay,uint64 scheduledCheckIn,uint64 checkInDeadline,uint64 scheduledCheckout,uint256 pricePerNight,uint256 basePrice,uint256 securityDeposit,uint256 escrowedAmount,uint256 tokenId,uint256 authorizationNonce,uint8 status,bool reviewSubmitted))',
  'function disputeDeadline(uint256) view returns (uint64)',
  'function getReview(uint256) view returns ((uint256 bookingId,uint256 listingId,address reviewer,uint8 rating,string uri,bytes32 contentHash,uint64 timestamp))',
  'function getListingRoomTypeIdsPage(uint256,uint256,uint256) view returns (uint256[] page,uint256 nextCursor)',
  'function getGuestBookingIdsPage(address,uint256,uint256) view returns (uint256[] page,uint256 nextCursor)',
  'function getHostBookingIdsPage(address,uint256,uint256) view returns (uint256[] page,uint256 nextCursor)',
  'function getListingBookingIdsPage(uint256,uint256,uint256) view returns (uint256[] page,uint256 nextCursor)',
  'function getListingReviewBookingIdsPage(uint256,uint256,uint256) view returns (uint256[] page,uint256 nextCursor)',
  'function createListing(string,string,string,uint32,int32,int32) returns (uint256)',
  'function addRoomType(uint256,string,string,uint256,uint32) returns (uint256)',
  'function setListingActive(uint256,bool)',
  'function setRoomTypeActive(uint256,bool)',
  'function book(uint256,uint256,uint32,uint32,uint32) returns (uint256)',
  'function cancelBooking(uint256)',
  'function checkIn(uint256,uint64,uint64,uint256,bytes)',
  'function revokeCheckInAuthorization(uint256)',
  'function settleNoShow(uint256)',
  'function completeStay(uint256)',
  'function openDispute(uint256,bytes32)',
  'function resolveDispute(uint256,uint8,bytes32)',
  'function resolveDisputeAfterDeadline(uint256)',
  'function pause()',
  'function unpause()',
  'function withdraw()',
  'function submitReview(uint256,uint8,string,bytes32)',
]

const ERC20_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]

function configuredContract(chainId) {
  const chain = getChainConfig(chainId)
  if (!chain.v3Address) throw new Error(`HospitalityBookingV3 is not configured on ${chain.name}`)
  return chain
}

export function getV3ReadContract(chainId) {
  const chain = configuredContract(chainId)
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.id, { staticNetwork: true })
  return new ethers.Contract(chain.v3Address, V3_ABI, provider)
}

async function signerFromWalletClient(walletClient, chainId) {
  if (!walletClient?.account?.address) throw new Error('Connect a wallet first')
  assertWalletChain(walletClient, chainId)
  const eip1193 = {
    request: ({ method, params }) => walletClient.request({ method, params }),
  }
  const provider = new ethers.BrowserProvider(eip1193)
  return provider.getSigner(walletClient.account.address)
}

export function assertWalletChain(walletClient, chainId) {
  if (Number(walletClient?.chain?.id) !== Number(chainId)) {
    throw new Error(`Wallet is on chain ${walletClient?.chain?.id}; switch to chain ${chainId}`)
  }
}

export async function getV3WriteContract(walletClient, chainId) {
  const chain = configuredContract(chainId)
  const signer = await signerFromWalletClient(walletClient, chainId)
  return new ethers.Contract(chain.v3Address, V3_ABI, signer)
}

async function waitForTransaction(transaction, onStatus = () => {}) {
  onStatus({ state: 'pending', hash: transaction.hash })
  try {
    const receipt = await transaction.wait()
    onStatus({ state: 'finalized', hash: receipt.hash, receipt })
    return receipt
  } catch (error) {
    if (error?.code === 'TRANSACTION_REPLACED' && !error.cancelled) {
      onStatus({ state: 'replaced', hash: error.replacement?.hash })
      const receipt = error.receipt || (await error.replacement.wait())
      onStatus({ state: 'finalized', hash: receipt.hash, receipt })
      return receipt
    }
    onStatus({ state: 'failed', error })
    throw error
  }
}

async function readAllIdPages(contract, method, key) {
  const ids = []
  let cursor = 0n
  do {
    const [page, next] = await contract[method](key, cursor, 50)
    ids.push(...page)
    cursor = next
  } while (cursor !== 0n)
  return ids
}

export async function getV3TokenInfo(chainId) {
  const contract = getV3ReadContract(chainId)
  const tokenAddress = await contract.paymentToken()
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, contract.runner)
  const [decimals, symbol, securityDepositBps] = await Promise.all([
    token.decimals(),
    token.symbol(),
    contract.securityDepositBps(),
  ])
  return {
    address: tokenAddress,
    decimals: Number(decimals),
    symbol,
    securityDepositBps: Number(securityDepositBps),
  }
}

export async function getV3Listings(chainId, { includeInactive = false } = {}) {
  const contract = getV3ReadContract(chainId)
  const listings = []
  let cursor = 0n
  do {
    const [page, next] = await contract.getListingsPage(cursor, 50)
    listings.push(...page)
    cursor = next
  } while (cursor !== 0n)
  return includeInactive ? listings : listings.filter((listing) => listing.active)
}

export async function getV3ListingWithRooms(chainId, listingId) {
  const contract = getV3ReadContract(chainId)
  const [listing, roomIds] = await Promise.all([
    contract.getListing(listingId),
    readAllIdPages(contract, 'getListingRoomTypeIdsPage', listingId),
  ])
  const rooms = await Promise.all(roomIds.map((id) => contract.getRoomType(id)))
  return { listing, rooms }
}

export async function getV3GuestBookings(chainId, guest) {
  if (!guest) return []
  const contract = getV3ReadContract(chainId)
  const ids = await readAllIdPages(contract, 'getGuestBookingIdsPage', guest)
  return Promise.all(ids.map((id) => contract.getBooking(id)))
}

export async function getV3HostBookings(chainId, host) {
  if (!host) return []
  const contract = getV3ReadContract(chainId)
  const ids = await readAllIdPages(contract, 'getHostBookingIdsPage', host)
  return Promise.all(ids.map((id) => contract.getBooking(id)))
}

export async function getV3PendingWithdrawal(chainId, account) {
  if (!account) return 0n
  return getV3ReadContract(chainId).pendingWithdrawals(account)
}

export async function getV3RoleState(chainId, account) {
  if (!account) return { isPauser: false, isArbitrator: false, paused: false }
  const contract = getV3ReadContract(chainId)
  const [pauserRole, arbitratorRole, paused] = await Promise.all([
    contract.PAUSER_ROLE(),
    contract.ARBITRATOR_ROLE(),
    contract.paused(),
  ])
  const [isPauser, isArbitrator] = await Promise.all([
    contract.hasRole(pauserRole, account),
    contract.hasRole(arbitratorRole, account),
  ])
  return { isPauser, isArbitrator, paused }
}

export async function approveAndBook(
  walletClient,
  chainId,
  { listingId, roomTypeId, rooms, checkInDate, checkOutDate },
  onStatus
) {
  const { checkInDay, checkOutDay, nights } = validateStayDates(checkInDate, checkOutDate)
  const contract = await getV3WriteContract(walletClient, chainId)
  const room = await contract.getRoomType(roomTypeId)
  const securityBps = await contract.securityDepositBps()
  const base = room.pricePerNight * BigInt(rooms) * BigInt(nights)
  const total = base + (base * securityBps) / 10_000n
  const tokenAddress = await contract.paymentToken()
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, contract.runner)
  const owner = await contract.runner.getAddress()
  const allowance = await token.allowance(owner, await contract.getAddress())
  if (allowance < total) {
    const approval = await token.approve(await contract.getAddress(), total)
    await waitForTransaction(approval, onStatus)
  }
  const available = await contract.isAvailable(roomTypeId, rooms, checkInDay, checkOutDay)
  if (!available) throw new Error('The selected room range is no longer available')
  return waitForTransaction(
    await contract.book(listingId, roomTypeId, rooms, checkInDay, checkOutDay),
    onStatus
  )
}

export async function signCheckInAuthorization(walletClient, chainId, bookingId, validity = {}) {
  const contract = getV3ReadContract(chainId)
  const booking = await contract.getBooking(bookingId)
  const validAfter = BigInt(validity.validAfter ?? booking.scheduledCheckIn)
  const validUntil = BigInt(validity.validUntil ?? booking.checkInDeadline)
  const message = {
    bookingId: BigInt(bookingId),
    guest: booking.guest,
    nonce: booking.authorizationNonce,
    validAfter,
    validUntil,
  }
  const signature = await walletClient.signTypedData({
    account: walletClient.account,
    domain: {
      name: 'HospitalityBookingV3',
      version: '1',
      chainId: Number(chainId),
      verifyingContract: configuredContract(chainId).v3Address,
    },
    types: {
      CheckInAuthorization: [
        { name: 'bookingId', type: 'uint256' },
        { name: 'guest', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'validAfter', type: 'uint64' },
        { name: 'validUntil', type: 'uint64' },
      ],
    },
    primaryType: 'CheckInAuthorization',
    message,
  })
  return { ...message, signature }
}

export async function submitCheckIn(walletClient, chainId, authorization, onStatus) {
  const contract = await getV3WriteContract(walletClient, chainId)
  return waitForTransaction(
    await contract.checkIn(
      authorization.bookingId,
      authorization.validAfter,
      authorization.validUntil,
      authorization.nonce,
      authorization.signature
    ),
    onStatus
  )
}

export async function sendV3Action(walletClient, chainId, method, args = [], onStatus) {
  const contract = await getV3WriteContract(walletClient, chainId)
  return waitForTransaction(await contract[method](...args), onStatus)
}

export function canonicalJSONString(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSONString).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSONString(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function reviewContentHash(reviewJSON) {
  return ethers.keccak256(ethers.toUtf8Bytes(canonicalJSONString(reviewJSON)))
}

export { waitForTransaction }
