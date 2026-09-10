import { describe, expect, it } from 'vitest'
import { canonicalJSONString, reviewContentHash } from '@/services/blockchain'

describe('review hashing', () => {
  it('sorts object keys recursively and produces a stable keccak256 hash', () => {
    const first = { rating: 5, nested: { z: 1, a: 2 }, review: 'Great' }
    const second = { review: 'Great', nested: { a: 2, z: 1 }, rating: 5 }
    expect(canonicalJSONString(first)).toBe(canonicalJSONString(second))
    expect(reviewContentHash(first)).toBe(reviewContentHash(second))
    expect(reviewContentHash(first)).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
