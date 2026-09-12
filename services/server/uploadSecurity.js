import { getToken } from 'next-auth/jwt'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_JSON_BYTES = 64 * 1024
const DAY_SECONDS = 86_400
const developmentCounters = new Map()

export function resetDevelopmentUploadQuotasForTests() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test-only quota reset')
  developmentCounters.clear()
}

function requestOrigin(req) {
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = forwardedProtocol || (req.socket?.encrypted ? 'https' : 'http')
  return `${protocol}://${req.headers.host}`
}

export function assertSameOrigin(req) {
  const origin = req.headers.origin
  const expected = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : requestOrigin(req)
  if (!origin || origin !== expected) throw Object.assign(new Error('Origin rejected'), { status: 403 })
  if (req.headers['x-hospitality-csrf'] !== '1') {
    throw Object.assign(new Error('CSRF check failed'), { status: 403 })
  }
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite && fetchSite !== 'same-origin') {
    throw Object.assign(new Error('Cross-site request rejected'), { status: 403 })
  }
}

export async function requireWalletSession(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub || !/^0x[0-9a-fA-F]{40}$/.test(token.sub)) {
    throw Object.assign(new Error('Wallet authentication required'), { status: 401 })
  }
  return token.sub.toLowerCase()
}

function clientIP(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return (forwarded || req.socket?.remoteAddress || 'unknown').slice(0, 80)
}

function quotaWindow() {
  return Math.floor(Date.now() / (DAY_SECONDS * 1000))
}

function quotaLimits(type) {
  const walletLimit = type === 'file' ? 20 : 50
  return { walletLimit, ipLimit: walletLimit * 2 }
}

function consumeDevelopmentQuota(keys, limits) {
  keys.forEach((key, index) => {
    const value = (developmentCounters.get(key) || 0) + 1
    developmentCounters.set(key, value)
    if (value > limits[index]) {
      throw Object.assign(new Error('Daily upload quota exceeded'), { status: 429 })
    }
  })
}

export async function consumeUploadQuota(req, wallet, type) {
  const { walletLimit, ipLimit } = quotaLimits(type)
  const window = quotaWindow()
  const keys = [
    `hospitality:pin:${window}:wallet:${wallet}:${type}`,
    `hospitality:pin:${window}:ip:${clientIP(req)}:${type}`,
  ]
  const redisURL = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!redisURL || !redisToken) {
    if (process.env.NODE_ENV === 'production') {
      throw Object.assign(new Error('Upload service unavailable'), { status: 503 })
    }
    consumeDevelopmentQuota(keys, [walletLimit, ipLimit])
    return
  }

  try {
    const response = await fetch(`${redisURL.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', keys[0]],
        ['EXPIRE', keys[0], DAY_SECONDS, 'NX'],
        ['INCR', keys[1]],
        ['EXPIRE', keys[1], DAY_SECONDS, 'NX'],
      ]),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) throw new Error('Redis request failed')
    const results = await response.json()
    const walletCount = Number(results?.[0]?.result)
    const ipCount = Number(results?.[2]?.result)
    if (!Number.isFinite(walletCount) || !Number.isFinite(ipCount)) throw new Error('Redis response invalid')
    if (walletCount > walletLimit || ipCount > ipLimit) {
      throw Object.assign(new Error('Daily upload quota exceeded'), { status: 429 })
    }
  } catch (error) {
    if (error?.status === 429) throw error
    if (process.env.NODE_ENV === 'production') {
      throw Object.assign(new Error('Upload service unavailable'), { status: 503 })
    }
    consumeDevelopmentQuota(keys, [walletLimit, ipLimit])
  }
}

function isJPEG(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
}

function isPNG(buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
}

function isWebP(buffer) {
  return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
}

function isAVIF(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false
  for (let offset = 8; offset + 4 <= Math.min(buffer.length, 64); offset += 4) {
    const brand = buffer.toString('ascii', offset, offset + 4)
    if (brand === 'avif' || brand === 'avis') return true
  }
  return false
}

export function validateImagePayload({ data, contentType }) {
  if (typeof data !== 'string' || !data || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    throw Object.assign(new Error('Invalid base64 image data'), { status: 400 })
  }
  const buffer = Buffer.from(data, 'base64')
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('Image must be between 1 byte and 8 MB'), { status: 413 })
  }
  const validators = {
    'image/jpeg': isJPEG,
    'image/png': isPNG,
    'image/webp': isWebP,
    'image/avif': isAVIF,
  }
  const validator = validators[contentType]
  if (!validator || !validator(buffer)) {
    throw Object.assign(new Error('Image MIME type does not match its signature'), { status: 415 })
  }
  return buffer
}

function validateListing(content) {
  return (
    Object.keys(content).every((key) => ['schema', 'name', 'description', 'image'].includes(key)) &&
    typeof content.name === 'string' &&
    content.name.trim().length > 0 &&
    content.name.length <= 120 &&
    typeof content.description === 'string' &&
    content.description.length <= 5_000 &&
    typeof content.image === 'string' &&
    content.image.startsWith('ipfs://')
  )
}

function validateReview(content) {
  return (
    Object.keys(content).every((key) =>
      ['schema', 'bookingId', 'listingId', 'rating', 'review', 'reviewer'].includes(key)
    ) &&
    /^\d+$/.test(String(content.bookingId || '')) &&
    /^\d+$/.test(String(content.listingId || '')) &&
    Number.isInteger(content.rating) &&
    content.rating >= 1 &&
    content.rating <= 5 &&
    typeof content.review === 'string' &&
    content.review.trim().length > 0 &&
    content.review.length <= 5_000 &&
    /^0x[0-9a-fA-F]{40}$/.test(content.reviewer || '')
  )
}

export function validateJSONPayload(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw Object.assign(new Error('JSON content must be an object'), { status: 400 })
  }
  const json = JSON.stringify(content)
  if (Buffer.byteLength(json) > MAX_JSON_BYTES) {
    throw Object.assign(new Error('JSON payload exceeds 64 KB'), { status: 413 })
  }
  const schema = content.schema
  const valid =
    (schema === 'hospitality-booking/listing/1' && validateListing(content)) ||
    (schema === 'hospitality-booking/review/1' && validateReview(content))
  if (!valid) throw Object.assign(new Error('JSON does not match a supported schema'), { status: 400 })
  return json
}

export function sanitizePinName(value, fallback) {
  const cleaned = String(value || fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}
