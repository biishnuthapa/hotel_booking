import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoleControls } from '@/pages/admin'

describe('multisig role controls', () => {
  it('enables pause only for pausers and dispute resolution only for arbitrators', () => {
    const onPause = vi.fn()
    const onResolve = vi.fn()
    const { rerender } = render(
      <RoleControls
        roles={{ isPauser: false, isArbitrator: false, paused: false }}
        onPause={onPause}
        onResolve={onResolve}
      />
    )
    expect(screen.getByRole('button', { name: 'Pause protocol' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Resolve dispute' }).disabled).toBe(true)

    rerender(
      <RoleControls
        roles={{ isPauser: true, isArbitrator: true, paused: false }}
        onPause={onPause}
        onResolve={onResolve}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Pause protocol' }))
    expect(onPause).toHaveBeenCalledWith('pause')
  })
})
