import { describe, expect, it } from 'vitest'
import {
  decodeAuthorizationPayload,
  encodeAuthorizationPayload,
  parseCheckInAuthorization,
} from '@/utils/checkInAuthorization'

const guest = '0x1111111111111111111111111111111111111111'
const contract = '0x2222222222222222222222222222222222222222'
const signature = `0x${'ab'.repeat(65)}`
const authorization = {
  bookingId: '7',
  guest,
  nonce: '2',
  validAfter: '100',
  validUntil: '200',
  chainId: 80002,
  verifyingContract: contract,
  signature,
}

describe('check-in authorization payloads', () => {
  it('round-trips UTF-8 JSON through a URL-safe payload', () => {
    const json = JSON.stringify({ ...authorization, note: 'Arrivée ✓' })
    expect(decodeAuthorizationPayload(encodeAuthorizationPayload(json))).toBe(json)
  })

  it('validates chain, contract, guest, signature, and numeric ranges', () => {
    const parsed = parseCheckInAuthorization(JSON.stringify(authorization), {
      chainId: 80002,
      verifyingContract: contract,
      guest,
    })
    expect(parsed.bookingId).toBe(7n)
    expect(parsed.nonce).toBe(2n)
  })

  it('rejects payloads bound to another chain, contract, or guest', () => {
    expect(() => parseCheckInAuthorization(authorization, { chainId: 137 })).toThrow('chain 137')
    expect(() =>
      parseCheckInAuthorization(authorization, {
        verifyingContract: '0x3333333333333333333333333333333333333333',
      })
    ).toThrow('different HospitalityBooking contract')
    expect(() =>
      parseCheckInAuthorization(authorization, {
        guest: '0x4444444444444444444444444444444444444444',
      })
    ).toThrow('different guest wallet')
  })

  it('rejects malformed and reversed authorization windows', () => {
    expect(() => decodeAuthorizationPayload('***')).toThrow('invalid authorization payload')
    expect(() => parseCheckInAuthorization({ ...authorization, validAfter: '201' })).toThrow(
      'reversed'
    )
    expect(() => parseCheckInAuthorization({ ...authorization, signature: '0x12' })).toThrow(
      'signature'
    )
  })
})
