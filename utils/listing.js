export const MAX_PROPERTY_IMAGE_BYTES = 8 * 1024 * 1024

const ALLOWED_PROPERTY_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])

export function validatePropertyImage(file) {
  if (!file) throw new Error('Choose a property image')
  if (!ALLOWED_PROPERTY_IMAGE_TYPES.has(file.type)) {
    throw new Error('Use a JPEG, PNG, WebP, or AVIF image')
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_PROPERTY_IMAGE_BYTES) {
    throw new Error('The property image must be between 1 byte and 8 MB')
  }
  return file
}

export function timeStringToOffsetMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''))
  if (!match) throw new Error('Enter a valid UTC time')
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error('Enter a valid UTC time')
  return hours * 60 + minutes
}

export function validateListingDraft(form) {
  const name = String(form.name || '').trim()
  const description = String(form.description || '').trim()
  const totalRooms = Number(form.totalRooms)
  if (!name || name.length > 120)
    throw new Error('Property name must be between 1 and 120 characters')
  if (!description || description.length > 5_000) {
    throw new Error('Description must be between 1 and 5,000 characters')
  }
  if (!Number.isSafeInteger(totalRooms) || totalRooms < 1 || totalRooms > 4_294_967_295) {
    throw new Error('Total room inventory must be a positive whole number')
  }
  return {
    name,
    description,
    totalRooms,
    checkInOffsetMinutes: timeStringToOffsetMinutes(form.checkInTime),
    checkOutOffsetMinutes: timeStringToOffsetMinutes(form.checkOutTime),
  }
}
