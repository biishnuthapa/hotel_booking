import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { validateEnvironment } = require('../scripts/validate-frontend-config.js')

const validPublicEnvironment = {
  NEXT_PUBLIC_CHAIN_ID: '80002',
  NEXT_PUBLIC_AMOY_RPC_URL: 'https://rpc.example.com',
  NEXT_PUBLIC_AMOY_BOOKING_ADDRESS: '0x1111111111111111111111111111111111111111',
  NEXT_PUBLIC_AMOY_REVIEW_REGISTRY: '0x2222222222222222222222222222222222222222',
  NEXT_PUBLIC_AMOY_LENS_ADDRESS: '0x3333333333333333333333333333333333333333',
  NEXT_PUBLIC_AMOY_PAYMENT_TOKEN: '0x4444444444444444444444444444444444444444',
  NEXT_PUBLIC_AMOY_DEPLOYMENT_BLOCK: '123',
}

describe('production frontend configuration', () => {
  it('accepts a complete public Amoy deployment configuration', () => {
    const config = validateEnvironment(validPublicEnvironment, { publicOnly: true })
    expect(config.chainId).toBe(80002)
    expect(config.deploymentBlock).toBe(123)
  })

  it('rejects unsupported chains, zero addresses, and duplicate contracts', () => {
    expect(() =>
      validateEnvironment(
        { ...validPublicEnvironment, NEXT_PUBLIC_CHAIN_ID: '1' },
        { publicOnly: true }
      )
    ).toThrow('80002 or 137')
    expect(() =>
      validateEnvironment(
        {
          ...validPublicEnvironment,
          NEXT_PUBLIC_AMOY_BOOKING_ADDRESS: '0x0000000000000000000000000000000000000000',
        },
        { publicOnly: true }
      )
    ).toThrow('non-zero')
    expect(() =>
      validateEnvironment(
        {
          ...validPublicEnvironment,
          NEXT_PUBLIC_AMOY_LENS_ADDRESS: validPublicEnvironment.NEXT_PUBLIC_AMOY_BOOKING_ADDRESS,
        },
        { publicOnly: true }
      )
    ).toThrow('distinct')
  })

  it('requires production authentication and upload secrets without exposing them', () => {
    expect(() => validateEnvironment(validPublicEnvironment)).toThrow(
      'NEXT_PUBLIC_PROJECT_ID is required'
    )
  })
})
