import { describe, expect, it } from 'vitest'
import { assertWalletChain } from '@/services/blockchain'

describe('wallet chain switching guard', () => {
  it('accepts the configured connector chain and rejects a switched wallet', () => {
    expect(() => assertWalletChain({ chain: { id: 80002 } }, 80002)).not.toThrow()
    expect(() => assertWalletChain({ chain: { id: 137 } }, 80002)).toThrow('switch to chain 80002')
  })
})
