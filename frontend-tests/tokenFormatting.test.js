import { describe, expect, it } from 'vitest'
import { formatTokenAmount } from '@/utils/token'

describe('token amount formatting', () => {
  it('formats bigint atomic values using token metadata instead of native ETH assumptions', () => {
    expect(formatTokenAmount(123_456_789n, 6, 'USDC')).toBe('123.456789 USDC')
    expect(formatTokenAmount(1_000_000n, 6, 'mUSDC')).toBe('1 mUSDC')
  })
})
