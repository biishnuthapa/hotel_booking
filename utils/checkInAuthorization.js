import { ethers } from 'ethers'

const MAX_AUTHORIZATION_BYTES = 8 * 1024
const UINT64_MAX = (1n << 64n) - 1n

function bytesToBase64(bytes) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

export function encodeAuthorizationPayload(value) {
  const json = typeof value === 'string' ? value : JSON.stringify(value)
  const bytes = new TextEncoder().encode(json)
  if (!bytes.length || bytes.length > MAX_AUTHORIZATION_BYTES) {
    throw new Error('Authorization payload is empty or too large')
  }
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeAuthorizationPayload(value) {
  const input = String(value || '').trim()
  if (!input || input.length > MAX_AUTHORIZATION_BYTES * 2 || !/^[A-Za-z0-9_-]+$/.test(input)) {
    throw new Error('Check-in link contains an invalid authorization payload')
  }
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  let binary
  try {
    binary = atob(padded)
  } catch {
    throw new Error('Check-in link contains an invalid authorization payload')
  }
  if (!binary.length || binary.length > MAX_AUTHORIZATION_BYTES) {
    throw new Error('Authorization payload is empty or too large')
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Authorization payload is not valid UTF-8')
  }
}

function unsignedInteger(value, label, maximum) {
  let parsed
  try {
    parsed = BigInt(value)
  } catch {
    throw new Error(`${label} must be an unsigned integer`)
  }
  if (parsed < 0n || (maximum !== undefined && parsed > maximum)) {
    throw new Error(`${label} is outside its valid range`)
  }
  return parsed
}

export function parseCheckInAuthorization(value, expected = {}) {
  let parsed
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    throw new Error('Authorization must be valid JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Authorization must be a JSON object')
  }

  const bookingId = unsignedInteger(parsed.bookingId, 'Booking ID')
  const nonce = unsignedInteger(parsed.nonce, 'Nonce')
  const validAfter = unsignedInteger(parsed.validAfter, 'Valid-after time', UINT64_MAX)
  const validUntil = unsignedInteger(parsed.validUntil, 'Valid-until time', UINT64_MAX)
  const chainId = Number(parsed.chainId)
  if (bookingId === 0n) throw new Error('Booking ID must be greater than zero')
  if (validUntil < validAfter) throw new Error('Authorization validity window is reversed')
  if (!Number.isSafeInteger(chainId) || chainId <= 0)
    throw new Error('Authorization chain ID is invalid')
  if (!ethers.isAddress(parsed.guest)) throw new Error('Authorization guest address is invalid')
  if (!ethers.isAddress(parsed.verifyingContract)) {
    throw new Error('Authorization contract address is invalid')
  }
  if (!ethers.isHexString(parsed.signature, 65))
    throw new Error('Authorization signature is invalid')

  if (expected.chainId !== undefined && chainId !== Number(expected.chainId)) {
    throw new Error(`Authorization is for chain ${chainId}, not chain ${expected.chainId}`)
  }
  if (
    expected.verifyingContract &&
    parsed.verifyingContract.toLowerCase() !== expected.verifyingContract.toLowerCase()
  ) {
    throw new Error('Authorization is for a different HospitalityBooking contract')
  }
  if (expected.guest && parsed.guest.toLowerCase() !== expected.guest.toLowerCase()) {
    throw new Error('Authorization is bound to a different guest wallet')
  }

  return {
    bookingId,
    guest: ethers.getAddress(parsed.guest),
    nonce,
    validAfter,
    validUntil,
    chainId,
    verifyingContract: ethers.getAddress(parsed.verifyingContract),
    signature: parsed.signature,
  }
}
