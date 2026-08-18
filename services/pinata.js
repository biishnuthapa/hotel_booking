import axios from 'axios'

/** Read a File/Blob as a base64 string (without the data: prefix). */
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result || ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

/** Pin an image File to IPFS. Returns { cid, uri, gatewayUrl }. */
export const pinImage = async (file) => {
  const data = await fileToBase64(file)
  const { data: result } = await axios.post('/api/pinata/pin', {
    type: 'file',
    filename: file.name,
    contentType: file.type,
    data,
  })
  return result
}

/** Pin an ERC-721 metadata JSON to IPFS. Returns { cid, uri, gatewayUrl }. */
export const pinJson = async (content, pinName) => {
  const { data: result } = await axios.post('/api/pinata/pin', {
    type: 'json',
    content,
    pinName,
  })
  return result
}

/**
 * Full NFT pin: upload the image, then build and pin the metadata JSON that
 * references it. Returns the JSON pin result plus the image URI.
 */
export const pinNftMetadata = async ({ image, name, description }) => {
  const img = await pinImage(image)
  const json = await pinJson(
    { name, description, image: img.uri },
    `${name || 'property'}-metadata.json`
  )
  return { ...json, imageUri: img.uri, imageGatewayUrl: img.gatewayUrl }
}
