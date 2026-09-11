export const SECONDS_PER_DAY = 86_400
export const MAX_STAY_NIGHTS = 90

export function dateStringToEpochDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new Error('Date must use YYYY-MM-DD')
  }
  const [year, month, day] = value.split('-').map(Number)
  const milliseconds = Date.UTC(year, month - 1, day)
  const date = new Date(milliseconds)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Invalid calendar date')
  }
  return Math.floor(milliseconds / (SECONDS_PER_DAY * 1000))
}

export function epochDayToDateString(epochDay) {
  const value = Number(epochDay)
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid epoch day')
  return new Date(value * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10)
}

export function validateStayDates(checkInDate, checkOutDate) {
  const checkInDay = dateStringToEpochDay(checkInDate)
  const checkOutDay = dateStringToEpochDay(checkOutDate)
  const nights = checkOutDay - checkInDay
  if (nights <= 0) throw new Error('Checkout must be after check-in')
  if (nights > MAX_STAY_NIGHTS) throw new Error('Stays are limited to 90 nights')
  return { checkInDay, checkOutDay, nights }
}

export function eachStayDay(checkInDay, checkOutDay) {
  const result = []
  for (let day = Number(checkInDay); day < Number(checkOutDay); day += 1) result.push(day)
  return result
}

export function todayUTCDateString(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10)
}

export function addDaysToDateString(value, days) {
  const epochDay = dateStringToEpochDay(value)
  return epochDayToDateString(epochDay + Number(days))
}

export function formatEpochDay(epochDay, options = {}) {
  const date = new Date(Number(epochDay) * SECONDS_PER_DAY * 1000)
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(date)
}
