import { describe, expect, it } from 'vitest'
import {
  dateStringToEpochDay,
  eachStayDay,
  epochDayToDateString,
  validateStayDates,
} from '@/utils/dates'

describe('canonical booking dates', () => {
  it('maps a date string to the same epoch day regardless of local timezone semantics', () => {
    const day = dateStringToEpochDay('2026-11-01')
    expect(day).toBe(Math.floor(Date.UTC(2026, 10, 1) / 86_400_000))
    expect(epochDayToDateString(day)).toBe('2026-11-01')
  })

  it('uses exclusive checkout and validates every interior day', () => {
    const stay = validateStayDates('2026-08-20', '2026-08-23')
    expect(stay.nights).toBe(3)
    expect(eachStayDay(stay.checkInDay, stay.checkOutDay)).toEqual([
      stay.checkInDay,
      stay.checkInDay + 1,
      stay.checkInDay + 2,
    ])
  })

  it('rejects invalid dates and stays longer than 90 nights', () => {
    expect(() => dateStringToEpochDay('2026-02-30')).toThrow('Invalid calendar date')
    expect(() => validateStayDates('2026-01-01', '2026-04-02')).toThrow('90 nights')
  })
})
