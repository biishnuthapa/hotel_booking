import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('wagmi', () => ({ useAccount: () => ({ address: undefined }) }))
vi.mock('@/services/blockchainLegacy', () => ({
  getLegacyGuestBookings: vi.fn(),
  getLegacyListings: vi.fn(),
  getLegacyOwnedTokens: vi.fn(),
}))

import LegacyPage from '@/pages/legacy'

describe('legacy separation', () => {
  it('labels V1 as read-only and exposes no transaction controls', () => {
    render(
      <LegacyPage
        listings={[{ id: 1, name: 'Historical Hotel', location: 'Denver', images: [] }]}
        explorerUrl="https://amoy.polygonscan.com"
        contractAddress="0x1111111111111111111111111111111111111111"
        loadError={null}
      />
    )
    expect(screen.getByText(/Legacy V1 · read only/i)).toBeTruthy()
    expect(screen.getByText(/writes disabled/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
