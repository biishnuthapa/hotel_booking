export const toMillis = (timestamp) => {
  const value = Number(timestamp)
  if (!Number.isFinite(value)) return 0
  return value < 1e12 ? value * 1000 : value
}

export const normalizeIpfsUrl = (value) => {
  if (!value || typeof value !== 'string') return '/assets/image2.jpg'
  const trimmed = value.trim()
  if (trimmed.startsWith('ipfs://')) {
    const cidOrPath = trimmed.replace(/^ipfs:\/\/(ipfs\/)?/, '')
    const configured = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs'
    const gateway = configured.replace(/\/$/, '')
    return `${gateway}/${cidOrPath}`
  }
  if (/^https:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed
  return '/assets/image2.jpg'
}

export const formatDate = (timestamp) => {
  const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }
  const date = new Date(toMillis(timestamp))
  return date.toLocaleDateString('en-US', options)
}

export const shortAddress = (address) =>
  /^0x[0-9a-fA-F]{40}$/.test(address || '')
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : String(address || '')

export const truncate = (text, startChars, endChars, maxLength) => {
  if (text.length > maxLength) {
    let start = text.substring(0, startChars)
    let end = text.substring(text.length - endChars, text.length)
    while (start.length + end.length < maxLength) {
      start = start + '.'
    }
    return start + end
  }
  return text
}
