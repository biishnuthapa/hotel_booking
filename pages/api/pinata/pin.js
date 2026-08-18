/**
 * Server-side Pinata pinning proxy.
 *
 * Keeps PINATA_JWT out of the browser. The client sends either:
 *   { type: 'file', filename, contentType, data }  // data = base64 (no data: prefix)
 *   { type: 'json', content, pinName }              // content = arbitrary JSON object
 *
 * Responds with { cid, uri, gatewayUrl } where uri is `ipfs://<cid>`.
 *
 * Requires PINATA_JWT in the environment (a Pinata API key JWT with
 * pinFileToIPFS + pinJSONToIPFS scopes). Get one at https://app.pinata.cloud
 * (Developers → API Keys). Optionally set PINATA_GATEWAY to a dedicated gateway
 * host (e.g. my-gw.mypinata.cloud) for faster previews.
 */
export const config = {
  api: {
    bodyParser: { sizeLimit: '15mb' }, // room for base64-encoded images
  },
}

const PINATA_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    return res
      .status(500)
      .json({ error: 'PINATA_JWT is not configured on the server. Add it to .env and restart.' })
  }

  const gateway = process.env.PINATA_GATEWAY || 'ipfs.io'
  const toResult = (cid) => ({
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: `https://${gateway}/ipfs/${cid}`,
  })

  try {
    const { type } = req.body || {}

    if (type === 'file') {
      const { filename, contentType, data } = req.body
      if (!data) return res.status(400).json({ error: 'Missing file data' })

      const buffer = Buffer.from(data, 'base64')
      const form = new FormData()
      form.append(
        'file',
        new Blob([buffer], { type: contentType || 'application/octet-stream' }),
        filename || 'nft-image'
      )
      form.append('pinataMetadata', JSON.stringify({ name: filename || 'nft-image' }))

      const pinRes = await fetch(PINATA_FILE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: form,
      })
      const json = await pinRes.json()
      if (!pinRes.ok) {
        return res.status(pinRes.status).json({ error: json?.error || 'Pinata file pin failed' })
      }
      return res.status(200).json(toResult(json.IpfsHash))
    }

    if (type === 'json') {
      const { content, pinName } = req.body
      if (!content || typeof content !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid JSON content' })
      }

      const pinRes = await fetch(PINATA_JSON_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pinataContent: content,
          pinataMetadata: { name: pinName || 'nft-metadata.json' },
        }),
      })
      const json = await pinRes.json()
      if (!pinRes.ok) {
        return res.status(pinRes.status).json({ error: json?.error || 'Pinata JSON pin failed' })
      }
      return res.status(200).json(toResult(json.IpfsHash))
    }

    return res.status(400).json({ error: "Body must include type: 'file' or 'json'" })
  } catch (error) {
    console.error('Pinata pin error:', error)
    return res.status(500).json({ error: error.message || 'Pinning failed' })
  }
}
