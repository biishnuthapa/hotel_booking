import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }))

import { getToken } from 'next-auth/jwt'
import handler from '@/pages/api/pinata/pin'
import {
  resetDevelopmentUploadQuotasForTests,
  validateImagePayload,
  validateJSONPayload,
} from '@/services/server/uploadSecurity'

function request(body, headers = {}) {
  return {
    method: 'POST',
    body,
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      'x-hospitality-csrf': '1',
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1', encrypted: false },
  }
}

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
    setHeader(name, value) { this.headers[name] = value },
  }
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
  vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')
  vi.stubEnv('PINATA_JWT', 'test-pinata-jwt')
  vi.stubEnv('NODE_ENV', 'test')
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  resetDevelopmentUploadQuotasForTests()
  getToken.mockResolvedValue({ sub: '0x1111111111111111111111111111111111111111' })
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ IpfsHash: 'bafyTestCid' }),
  })
})

describe('pinning security boundary', () => {
  it('rejects missing SIWE sessions and cross-origin requests', async () => {
    getToken.mockResolvedValueOnce(null)
    const unauthenticated = response()
    await handler(request({ type: 'json', content: {} }), unauthenticated)
    expect(unauthenticated.statusCode).toBe(401)

    const crossOrigin = response()
    await handler(request({ type: 'json', content: {} }, { origin: 'https://evil.example' }), crossOrigin)
    expect(crossOrigin.statusCode).toBe(403)
  })

  it('detects MIME spoofing and accepts matching signatures', () => {
    const png = Buffer.from('89504e470d0a1a0a00000000', 'hex')
    expect(() =>
      validateImagePayload({ data: png.toString('base64'), contentType: 'image/jpeg' })
    ).toThrow('signature')
    expect(
      validateImagePayload({ data: png.toString('base64'), contentType: 'image/png' })
    ).toEqual(png)
  })

  it('rejects oversized images and JSON beyond 64 KB', () => {
    const oversized = Buffer.alloc(8 * 1024 * 1024 + 1, 0)
    expect(() =>
      validateImagePayload({ data: oversized.toString('base64'), contentType: 'image/png' })
    ).toThrow('8 MB')
    expect(() =>
      validateJSONPayload({
        schema: 'hospitality-booking-v3/listing/1',
        name: 'Hotel',
        description: 'Valid',
        image: 'ipfs://image',
        padding: 'x'.repeat(65 * 1024),
      })
    ).toThrow('64 KB')
  })

  it('enforces daily wallet image quotas', async () => {
    const jpeg = Buffer.from('ffd8ff00', 'hex').toString('base64')
    for (let index = 0; index < 20; index += 1) {
      const res = response()
      await handler(
        request({ type: 'file', filename: 'photo.jpg', contentType: 'image/jpeg', data: jpeg }),
        res
      )
      expect(res.statusCode).toBe(200)
    }
    const limited = response()
    await handler(
      request({ type: 'file', filename: 'photo.jpg', contentType: 'image/jpeg', data: jpeg }),
      limited
    )
    expect(limited.statusCode).toBe(429)
  })

  it('fails closed when Redis is unavailable in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-token')
    global.fetch = vi.fn().mockRejectedValue(new Error('redis down'))
    const res = response()
    await handler(request({ type: 'json', content: {} }), res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('Upload service unavailable')
  })

  it('hides Pinata failures and timeouts behind a generic response', async () => {
    const content = {
      schema: 'hospitality-booking-v3/review/1',
      bookingId: '1',
      listingId: '1',
      rating: 5,
      review: 'Great',
      reviewer: '0x1111111111111111111111111111111111111111',
    }
    global.fetch = vi.fn().mockRejectedValue(Object.assign(new Error('provider secret'), { name: 'AbortError' }))
    const res = response()
    await handler(request({ type: 'json', content, pinName: 'review.json' }), res)
    expect(res.statusCode).toBe(504)
    expect(res.body.error).toBe('Upload service unavailable')
    expect(JSON.stringify(res.body)).not.toContain('provider secret')
  })
})
