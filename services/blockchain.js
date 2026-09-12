import { ethers } from 'ethers'
import { assertDeploymentConfigured, getChainConfig } from '@/config/chains'
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

const BOOKING_ABI = [
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
  'function getListing(uint256) view returns ((uint256 id,address owner,string name,string metadataURI,string imageURI,uint32 totalRooms,uint32 allocatedCapacity,int32 checkInOffsetMinutes,int32 checkOutOffsetMinutes,bool active,uint64 createdAt))',
  'function getRoomType(uint256) view returns ((uint256 id,uint256 listingId,string name,string metadataURI,uint256 pricePerNight,uint32 capacity,bool active))',
  'function getBooking(uint256) view returns ((uint256 id,uint256 listingId,uint256 roomTypeId,address host,address guest,uint32 rooms,uint32 checkInDay,uint32 checkOutDay,uint64 scheduledCheckIn,uint64 checkInDeadline,uint64 scheduledCheckout,uint256 pricePerNight,uint256 basePrice,uint256 securityDeposit,uint256 escrowedAmount,uint256 tokenId,uint256 authorizationNonce,uint8 status,bool hostAttested))',
  'function disputeDeadline(uint256) view returns (uint64)',
  'function disputeEvidenceHash(uint256) view returns (bytes32)',
  'function liabilityBalance() view returns (uint256)',
  'function createListing(string,string,string,uint32,int32,int32) returns (uint256)',
  'function updateListingMetadata(uint256,string,string,string)',
  'function updateListingSchedule(uint256,int32,int32)',
  'function increaseListingRooms(uint256,uint32)',
  'function addRoomType(uint256,string,string,uint256,uint32) returns (uint256)',
  'function updateRoomTypeMetadata(uint256,string,string)',
  'function updateRoomTypePrice(uint256,uint256)',
  'function increaseRoomTypeCapacity(uint256,uint32)',
  'function setListingActive(uint256,bool)',
  'function setRoomTypeActive(uint256,bool)',
  'function book(uint256,uint256,uint32,uint32,uint32) returns (uint256)',
  'function cancelBooking(uint256)',
  'function checkIn(uint256)',
  'function checkInAttested(uint256,uint64,uint64,uint256,bytes)',
  'function revokeCheckInAuthorization(uint256)',
  'function settleNoShow(uint256)',
  'function completeStay(uint256)',
  'function openDispute(uint256,bytes32)',
  'function resolveDispute(uint256,uint8,bytes32)',
  'function resolveDisputeAfterDeadline(uint256)',
  'function pause()',
  'function unpause()',
  'function withdraw()',
  'function totalListings() view returns (uint256)',
  'function totalBookings() view returns (uint256)',
  'function listingMaxActivePrice(uint256) view returns (uint256)',
  'function listingRoomTypeCount(uint256) view returns (uint256)',
  'function listingRoomTypeAt(uint256,uint256) view returns (uint256)',
  'function listingBookingCount(uint256) view returns (uint256)',
  'function listingBookingAt(uint256,uint256) view returns (uint256)',
  'function guestBookingCount(address) view returns (uint256)',
  'function guestBookingAt(address,uint256) view returns (uint256)',
  'function hostBookingCount(address) view returns (uint256)',
  'function hostBookingAt(address,uint256) view returns (uint256)',
]

const LENS_ABI = [
  'function getListingsPage(uint256,uint256) view returns ((uint256 id,address owner,string name,string metadataURI,string imageURI,uint32 totalRooms,uint32 allocatedCapacity,int32 checkInOffsetMinutes,int32 checkOutOffsetMinutes,bool active,uint64 createdAt)[] page,uint256 nextCursor)',
  'function getRatedListingsPage(uint256,uint256) view returns ((((uint256 id,address owner,string name,string metadataURI,string imageURI,uint32 totalRooms,uint32 allocatedCapacity,int32 checkInOffsetMinutes,int32 checkOutOffsetMinutes,bool active,uint64 createdAt)) listing,uint256 weightedRatingScaled,uint256 rawRatingScaled,uint256 reviewCount)[] page,uint256 nextCursor)',
  'function getListingRoomTypesPage(uint256,uint256,uint256) view returns ((uint256 id,uint256 listingId,string name,string metadataURI,uint256 pricePerNight,uint32 capacity,bool active)[] page,uint256 nextCursor)',
  'function getListingBookingsPage(uint256,uint256,uint256) view returns ((uint256 id,uint256 listingId,uint256 roomTypeId,address host,address guest,uint32 rooms,uint32 checkInDay,uint32 checkOutDay,uint64 scheduledCheckIn,uint64 checkInDeadline,uint64 scheduledCheckout,uint256 pricePerNight,uint256 basePrice,uint256 securityDeposit,uint256 escrowedAmount,uint256 tokenId,uint256 authorizationNonce,uint8 status,bool hostAttested)[] page,uint256 nextCursor)',
  'function getGuestBookingsPage(address,uint256,uint256) view returns ((uint256 id,uint256 listingId,uint256 roomTypeId,address host,address guest,uint32 rooms,uint32 checkInDay,uint32 checkOutDay,uint64 scheduledCheckIn,uint64 checkInDeadline,uint64 scheduledCheckout,uint256 pricePerNight,uint256 basePrice,uint256 securityDeposit,uint256 escrowedAmount,uint256 tokenId,uint256 authorizationNonce,uint8 status,bool hostAttested)[] page,uint256 nextCursor)',
  'function getHostBookingsPage(address,uint256,uint256) view returns ((uint256 id,uint256 listingId,uint256 roomTypeId,address host,address guest,uint32 rooms,uint32 checkInDay,uint32 checkOutDay,uint64 scheduledCheckIn,uint64 checkInDeadline,uint64 scheduledCheckout,uint256 pricePerNight,uint256 basePrice,uint256 securityDeposit,uint256 escrowedAmount,uint256 tokenId,uint256 authorizationNonce,uint8 status,bool hostAttested)[] page,uint256 nextCursor)',
  'function getListingReviewsPage(uint256,uint256,uint256) view returns ((uint256 bookingId,uint256 listingId,address reviewer,uint8 rating,uint16 weightBps,uint64 timestamp,string uri,bytes32 contentHash)[] page,uint256 nextCursor)',
]

const REVIEW_ABI = [
  'function submitReview(uint256,uint8,string,bytes32)',
  'function getReview(uint256) view returns ((uint256 bookingId,uint256 listingId,address reviewer,uint8 rating,uint16 weightBps,uint64 timestamp,string uri,bytes32 contentHash))',
  'function reviewed(uint256) view returns (bool)',
  'function weightedRating(uint256) view returns (uint256)',
  'function rawRating(uint256) view returns (uint256)',
  'function listingRawCount(uint256) view returns (uint256)',
  'function reviewEligibilityThreshold(uint256,uint256,uint256) view returns (uint256)',
  'function eligibilityBps() view returns (uint16)',
  'function unattestedWeightBps() view returns (uint16)',
]

const ERC20_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]

function configuredContract(chainId) {
  return assertDeploymentConfigured(chainId)
}

function readProvider(chain) {
  return new ethers.JsonRpcProvider(chain.rpcUrl, chain.id, { staticNetwork: true })
}

export function getLensContract(chainId) {
  const chain = configuredContract(chainId)
  if (!chain.lensAddress) throw new Error(`BookingLens is not configured on ${chain.name}`)
  return new ethers.Contract(chain.lensAddress, LENS_ABI, readProvider(chain))
}

export function getReviewReadContract(chainId) {
  const chain = configuredContract(chainId)
  if (!chain.reviewRegistryAddress) {
    throw new Error(`ReviewRegistry is not configured on ${chain.name}`)
  }
  return new ethers.Contract(chain.reviewRegistryAddress, REVIEW_ABI, readProvider(chain))
}

export async function getReviewWriteContract(walletClient, chainId) {
  const chain = configuredContract(chainId)
  const signer = await signerFromWalletClient(walletClient, chainId)
  return new ethers.Contract(chain.reviewRegistryAddress, REVIEW_ABI, signer)
}

export function getBookingReadContract(chainId) {
  const chain = configuredContract(chainId)
  return new ethers.Contract(chain.bookingAddress, BOOKING_ABI, readProvider(chain))
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

export async function getBookingWriteContract(walletClient, chainId) {
  const chain = configuredContract(chainId)
  const signer = await signerFromWalletClient(walletClient, chainId)
  return new ethers.Contract(chain.bookingAddress, BOOKING_ABI, signer)
}

async function waitForTransaction(transaction, onStatus = () => {}) {
  onStatus({ state: 'pending', hash: transaction.hash })
  try {
    const receipt = await transaction.wait()
    onStatus({ state: 'finalized', hash: receipt.hash, receipt })
    return receipt
  } catch (error) {
    if (error?.code === 'TRANSACTION_REPLACED') {
      if (error.cancelled) {
        onStatus({ state: 'cancelled', hash: error.replacement?.hash, error })
        throw error
      }
      onStatus({ state: 'replaced', hash: error.replacement?.hash })
      const receipt = error.receipt || (await error.replacement.wait())
      onStatus({ state: 'finalized', hash: receipt.hash, receipt })
      return receipt
    }
    onStatus({ state: 'failed', error })
    throw error
  }
}

async function readAllPages(contract, method, key) {
  const ids = []
  let cursor = 0n
  do {
    const [page, next] = await contract[method](key, cursor, 50)
    ids.push(...page)
    cursor = next
  } while (cursor !== 0n)
  return ids
}

export async function getPaymentTokenInfo(chainId) {
  const chain = configuredContract(chainId)
  const contract = getBookingReadContract(chainId)
  const tokenAddress = await contract.paymentToken()
  if (tokenAddress.toLowerCase() !== chain.paymentToken.toLowerCase()) {
    throw new Error('Configured payment token does not match the HospitalityBooking deployment')
  }
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, contract.runner)
  const [decimals, symbol, securityDepositBps, disputeBondBps] = await Promise.all([
    token.decimals(),
    token.symbol(),
    contract.securityDepositBps(),
    contract.disputeBondBps(),
  ])
  return {
    address: tokenAddress,
    decimals: Number(decimals),
    symbol,
    securityDepositBps: Number(securityDepositBps),
    disputeBondBps: Number(disputeBondBps),
  }
}

export async function getDeploymentHealth(chainId) {
  const chain = configuredContract(chainId)
  const provider = readProvider(chain)
  const entries = [
    ['HospitalityBooking', chain.bookingAddress],
    ['ReviewRegistry', chain.reviewRegistryAddress],
    ['BookingLens', chain.lensAddress],
    ['payment token', chain.paymentToken],
  ]
  const codes = await Promise.all(entries.map(([, address]) => provider.getCode(address)))
  const missingCode = entries.filter((_entry, index) => codes[index] === '0x').map(([name]) => name)
  if (missingCode.length) {
    throw new Error(`No contract code found for: ${missingCode.join(', ')}`)
  }
  const actualToken = await getBookingReadContract(chainId).paymentToken()
  if (actualToken.toLowerCase() !== chain.paymentToken.toLowerCase()) {
    throw new Error(
      'Configured payment token does not match the deployed HospitalityBooking contract'
    )
  }
  return { chain, checkedContracts: entries.length }
}

export async function getListings(chainId, { includeInactive = false } = {}) {
  const lens = getLensContract(chainId)
  const listings = []
  let cursor = 0n
  do {
    const [page, next] = await lens.getListingsPage(cursor, 50)
    listings.push(...page)
    cursor = next
  } while (cursor !== 0n)
  return includeInactive ? listings : listings.filter((listing) => listing.active)
}

export async function getListingWithRooms(chainId, listingId) {
  const contract = getBookingReadContract(chainId)
  const lens = getLensContract(chainId)
  const [listing, rooms] = await Promise.all([
    contract.getListing(listingId),
    readAllPages(lens, 'getListingRoomTypesPage', listingId),
  ])
  return { listing, rooms }
}

export async function getGuestBookings(chainId, guest) {
  if (!guest) return []
  return readAllPages(getLensContract(chainId), 'getGuestBookingsPage', guest)
}

export async function getHostBookings(chainId, host) {
  if (!host) return []
  return readAllPages(getLensContract(chainId), 'getHostBookingsPage', host)
}

export async function getListingBookings(chainId, listingId) {
  return readAllPages(getLensContract(chainId), 'getListingBookingsPage', listingId)
}

// --- Review integrity -------------------------------------------------------

export async function getListingReviews(chainId, listingId) {
  return readAllPages(getLensContract(chainId), 'getListingReviewsPage', listingId)
}

/** Weighted (mechanism) and unweighted (baseline) ratings as 0-5 numbers. */
export async function getListingRatings(chainId, listingId) {
  const reviews = getReviewReadContract(chainId)
  const [weighted, raw, count] = await Promise.all([
    reviews.weightedRating(listingId),
    reviews.rawRating(listingId),
    reviews.listingRawCount(listingId),
  ])
  return {
    weighted: Number(weighted) / 10000,
    raw: Number(raw) / 10000,
    count: Number(count),
    diverges: weighted !== raw,
  }
}

export async function getReviewEligibilityThreshold(chainId, listingId, nights, rooms) {
  return getReviewReadContract(chainId).reviewEligibilityThreshold(listingId, nights, rooms)
}

export async function hasReviewed(chainId, bookingId) {
  return getReviewReadContract(chainId).reviewed(bookingId)
}

export async function submitReview(walletClient, chainId, entry, onStatus = () => {}) {
  const contract = await getReviewWriteContract(walletClient, chainId)
  return waitForTransaction(
    await contract.submitReview(entry.bookingId, entry.rating, entry.uri, entry.contentHash),
    onStatus
  )
}

export async function getPendingWithdrawal(chainId, account) {
  if (!account) return 0n
  return getBookingReadContract(chainId).pendingWithdrawals(account)
}

export async function getDisputeInfo(chainId, bookingId) {
  const contract = getBookingReadContract(chainId)
  const [deadline, evidenceHash] = await Promise.all([
    contract.disputeDeadline(bookingId),
    contract.disputeEvidenceHash(bookingId),
  ])
  return { deadline: Number(deadline), evidenceHash }
}

export async function getRoleState(chainId, account) {
  if (!account) return { isPauser: false, isArbitrator: false, paused: false }
  const contract = getBookingReadContract(chainId)
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
  onStatus = () => {}
) {
  const { checkInDay, checkOutDay, nights } = validateStayDates(checkInDate, checkOutDate)
  const contract = await getBookingWriteContract(walletClient, chainId)
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
    await waitForTransaction(approval, (status) => onStatus({ ...status, action: 'approval' }))
  }
  const available = await contract.isAvailable(roomTypeId, rooms, checkInDay, checkOutDay)
  if (!available) throw new Error('The selected room range is no longer available')
  return waitForTransaction(
    await contract.book(listingId, roomTypeId, rooms, checkInDay, checkOutDay),
    (status) => onStatus({ ...status, action: 'booking' })
  )
}

export async function approveAndOpenDispute(
  walletClient,
  chainId,
  bookingId,
  evidenceHash,
  onStatus = () => {}
) {
  if (!ethers.isHexString(evidenceHash, 32) || evidenceHash === ethers.ZeroHash) {
    throw new Error('Evidence hash must be a non-zero bytes32 value')
  }
  const contract = await getBookingWriteContract(walletClient, chainId)
  const [booking, bondBps, tokenAddress] = await Promise.all([
    contract.getBooking(bookingId),
    contract.disputeBondBps(),
    contract.paymentToken(),
  ])
  const bond = (booking.escrowedAmount * bondBps + 9_999n) / 10_000n
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, contract.runner)
  const owner = await contract.runner.getAddress()
  const bookingAddress = await contract.getAddress()
  const allowance = await token.allowance(owner, bookingAddress)
  if (allowance < bond) {
    const approval = await token.approve(bookingAddress, bond)
    await waitForTransaction(approval, (status) =>
      onStatus({ ...status, action: 'dispute bond approval', bond })
    )
  }
  const receipt = await waitForTransaction(
    await contract.openDispute(bookingId, evidenceHash),
    (status) => onStatus({ ...status, action: 'open dispute', bond })
  )
  return { receipt, bond }
}

export async function signCheckInAuthorization(walletClient, chainId, bookingId, validity = {}) {
  assertWalletChain(walletClient, chainId)
  const contract = getBookingReadContract(chainId)
  const booking = await contract.getBooking(bookingId)
  const validAfter = BigInt(validity.validAfter ?? booking.scheduledCheckIn)
  const validUntil = BigInt(validity.validUntil ?? booking.checkInDeadline)
  if (walletClient.account.address.toLowerCase() !== booking.host.toLowerCase()) {
    throw new Error('Only the snapshotted booking host can sign this authorization')
  }
  if (
    validAfter < booking.scheduledCheckIn ||
    validUntil > booking.checkInDeadline ||
    validAfter > validUntil
  ) {
    throw new Error('Authorization validity must stay within the snapshotted check-in window')
  }
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
      name: 'HospitalityBooking',
      version: '1',
      chainId: Number(chainId),
      verifyingContract: configuredContract(chainId).bookingAddress,
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
  return {
    ...message,
    guest: booking.guest,
    chainId: Number(chainId),
    verifyingContract: configuredContract(chainId).bookingAddress,
    signature,
  }
}

export async function submitCheckIn(walletClient, chainId, authorization, onStatus = () => {}) {
  const contract = await getBookingWriteContract(walletClient, chainId)
  return waitForTransaction(
    await contract.checkInAttested(
      authorization.bookingId,
      authorization.validAfter,
      authorization.validUntil,
      authorization.nonce,
      authorization.signature
    ),
    (status) => onStatus({ ...status, action: 'check-in' })
  )
}

export async function sendBookingAction(walletClient, chainId, method, args = [], onStatus = () => {}) {
  const contract = await getBookingWriteContract(walletClient, chainId)
  return waitForTransaction(await contract[method](...args), (status) =>
    onStatus({ ...status, action: method })
  )
}

export function hashEvidenceReference(value) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error('Provide an evidence URI or reference')
  return ethers.keccak256(ethers.toUtf8Bytes(normalized))
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
