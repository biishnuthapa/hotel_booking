import {
  assertSameOrigin,
  consumeUploadQuota,
  requireWalletSession,
  sanitizePinName,
  validateImagePayload,
  validateJSONPayload,
} from '@/services/server/uploadSecurity'

export const config = {
  api: { bodyParser: { sizeLimit: '11mb' } },
}

const PINATA_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'
const UPSTREAM_TIMEOUT_MS = 10_000

function resultFor(cid) {
  if (!/^[A-Za-z0-9]+$/.test(cid || '')) throw new Error('Invalid provider response')
  const gateway = (process.env.PINATA_GATEWAY || 'ipfs.io').replace(/^https?:\/\//, '').replace(/\/$/, '')
  return { cid, uri: `ipfs://${cid}`, gatewayUrl: `https://${gateway}/ipfs/${cid}` }
}

async function pinataFetch(url, options) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.IpfsHash) throw new Error('Pinning provider rejected the request')
    return resultFor(body.IpfsHash)
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' })
  }

  try {
    assertSameOrigin(req)
    const wallet = await requireWalletSession(req)
    const type = req.body?.type
    if (type !== 'file' && type !== 'json') {
      return res.status(400).json({ error: "Body type must be 'file' or 'json'" })
    }
    await consumeUploadQuota(req, wallet, type)

    const jwt = process.env.PINATA_JWT
    if (!jwt) throw Object.assign(new Error('Upload service unavailable'), { status: 503 })

    if (type === 'file') {
      const buffer = validateImagePayload(req.body)
      const filename = sanitizePinName(req.body.filename, 'property-image')
      const form = new FormData()
      form.append('file', new Blob([buffer], { type: req.body.contentType }), filename)
      form.append('pinataMetadata', JSON.stringify({ name: filename, keyvalues: { wallet } }))
      const result = await pinataFetch(PINATA_FILE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: form,
      })
      return res.status(200).json(result)
    }

    const json = validateJSONPayload(req.body.content)
    const pinName = sanitizePinName(req.body.pinName, 'hospitality-metadata.json')
    const result = await pinataFetch(PINATA_JSON_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinataContent: JSON.parse(json),
        pinataMetadata: { name: pinName, keyvalues: { wallet } },
      }),
    })
    return res.status(200).json(result)
  } catch (error) {
    const status = Number(error?.status) || (error?.name === 'AbortError' ? 504 : 502)
    if (status >= 500) console.error('Pinning request failed', { status, name: error?.name })
    return res.status(status).json({
      error:
        status === 401 || status === 403 || status === 413 || status === 415 || status === 429
          ? error.message
          : status === 400
            ? error.message
            : 'Upload service unavailable',
    })
  }
}
