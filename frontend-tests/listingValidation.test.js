import { describe, expect, it } from 'vitest'
import {
  MAX_PROPERTY_IMAGE_BYTES,
  timeStringToOffsetMinutes,
  validateListingDraft,
  validatePropertyImage,
} from '@/utils/listing'

describe('listing creation validation', () => {
  it('converts UTC form times into contract offsets', () => {
    expect(timeStringToOffsetMinutes('00:00')).toBe(0)
    expect(timeStringToOffsetMinutes('15:30')).toBe(930)
    expect(timeStringToOffsetMinutes('23:59')).toBe(1439)
  })

  it('normalizes a valid listing draft', () => {
    expect(
      validateListingDraft({
        name: ' Harbour House ',
        description: ' A quiet stay ',
        totalRooms: '12',
        checkInTime: '15:00',
        checkOutTime: '11:00',
      })
    ).toEqual({
      name: 'Harbour House',
      description: 'A quiet stay',
      totalRooms: 12,
      checkInOffsetMinutes: 900,
      checkOutOffsetMinutes: 660,
    })
  })

  it('rejects unsupported and oversized images', () => {
    expect(() => validatePropertyImage({ type: 'image/svg+xml', size: 100 })).toThrow('JPEG')
    expect(() =>
      validatePropertyImage({ type: 'image/png', size: MAX_PROPERTY_IMAGE_BYTES + 1 })
    ).toThrow('8 MB')
    expect(validatePropertyImage({ type: 'image/webp', size: 100 })).toEqual({
      type: 'image/webp',
      size: 100,
    })
  })
})
