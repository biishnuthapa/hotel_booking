import { describe, expect, it, vi } from 'vitest'
import { waitForTransaction } from '@/services/blockchain'

describe('transaction state reporting', () => {
  it('reports pending and finalized confirmations', async () => {
    const states = []
    const receipt = { hash: '0xfinal' }
    await waitForTransaction(
      { hash: '0xpending', wait: vi.fn().mockResolvedValue(receipt) },
      (state) => states.push(state.state)
    )
    expect(states).toEqual(['pending', 'finalized'])
  })

  it('reports replacement before finalization', async () => {
    const states = []
    const replacement = {
      hash: '0xreplacement',
      wait: vi.fn().mockResolvedValue({ hash: '0xfinal' }),
    }
    const error = Object.assign(new Error('replaced'), {
      code: 'TRANSACTION_REPLACED',
      cancelled: false,
      replacement,
    })
    await waitForTransaction({ hash: '0xold', wait: vi.fn().mockRejectedValue(error) }, (state) =>
      states.push(state.state)
    )
    expect(states).toEqual(['pending', 'replaced', 'finalized'])
  })

  it('reports a cancelled replacement without claiming finalization', async () => {
    const states = []
    const error = Object.assign(new Error('cancelled'), {
      code: 'TRANSACTION_REPLACED',
      cancelled: true,
      replacement: { hash: '0xcancelled' },
    })
    await expect(
      waitForTransaction({ hash: '0xold', wait: vi.fn().mockRejectedValue(error) }, (state) =>
        states.push(state.state)
      )
    ).rejects.toThrow('cancelled')
    expect(states).toEqual(['pending', 'cancelled'])
  })
})
