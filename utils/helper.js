export const toMillis = (timestamp) => {
  const value = Number(timestamp)
  if (!Number.isFinite(value)) return 0
  return value < 1e12 ? value * 1000 : value
}

export const normalizeIpfsUrl = (value) => {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (trimmed.startsWith('ipfs://')) {
    const cidOrPath = trimmed.replace('ipfs://', '')
    return `https://ipfs.io/ipfs/${cidOrPath}`
  }
  return trimmed
}

export const formatDate = (timestamp) => {
  const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }
  const date = new Date(toMillis(timestamp))
  return date.toLocaleDateString('en-US', options)
}

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
