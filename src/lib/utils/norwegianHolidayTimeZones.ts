import { getNorwegianHolidays } from './norwegianHolidays'

export interface HolidayTimeZone {
  holidayName: string
  localName: string
  startDateTime: Date
  endDateTime: Date
  type: 'standard' | 'special' | 'may'
}

/**
 * Categories according to AML §10-10 (1)
 */
const HOLIDAY_CATEGORIES = {
  MAY: ['Labour Day', 'Constitution Day'] as const,
  SPECIAL: ['Easter Sunday', 'Whit Sunday', 'Christmas Day'] as const,
  SECOND_DAY: ['Easter Monday', 'Whit Monday', "St. Stephen's Day"] as const
} as const

type HolidayName = 
  | typeof HOLIDAY_CATEGORIES.MAY[number]
  | typeof HOLIDAY_CATEGORIES.SPECIAL[number]
  | typeof HOLIDAY_CATEGORIES.SECOND_DAY[number]

function isInCategory(
  holidayName: string,
  category: readonly string[]
): holidayName is HolidayName {
  return category.includes(holidayName)
}

/**
 * Create a local Date safely (avoids UTC shifts)
 */
function makeLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Add hours and minutes to a date (returns new Date instance)
 */
function addHours(date: Date, hours: number, minutes = 0): Date {
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Get all Norwegian holiday time zones (AML-based windows)
 * If a red day is immediately after another red day, it starts when the previous ends.
 */
export function getHolidayTimeZones(year: number): HolidayTimeZone[] {
  const holidays = getNorwegianHolidays(year)
  const timeZones: HolidayTimeZone[] = []

  // Sort holidays by date just in case
  holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  for (let i = 0; i < holidays.length; i++) {
    const h = holidays[i]
    const date = makeLocalDate(h.date)
    const dayBefore = new Date(date)
    dayBefore.setDate(date.getDate() - 1)

    let start: Date
    let end: Date
    let type: HolidayTimeZone['type']

    // Check if previous day is a red day (holiday or Sunday)
    const prevDayStr = formatDate(dayBefore)
    const isPrevDayHoliday = holidays.some(hol => hol.date === prevDayStr)
    const isPrevDaySunday = dayBefore.getDay() === 0
    const isPrevDayRedDay = isPrevDayHoliday || isPrevDaySunday

    if (isPrevDayRedDay) {
      // Start when previous red day ends
      const prevZone = timeZones[timeZones.length - 1]
      start = prevZone ? new Date(prevZone.endDateTime) : addHours(dayBefore, 22)
      end = addHours(date, 22)
      type = 'standard'
    } else if (isInCategory(h.name, HOLIDAY_CATEGORIES.MAY)) {
      start = addHours(dayBefore, 22)
      end = addHours(date, 22)
      type = 'may'
    } else if (isInCategory(h.name, HOLIDAY_CATEGORIES.SPECIAL)) {
      start = addHours(dayBefore, 15)
      end = addHours(date, 22)
      type = 'special'
    } else {
      start = addHours(dayBefore, 18)
      end = addHours(date, 22)
      type = 'standard'
    }

    timeZones.push({
      holidayName: h.name,
      localName: h.localName,
      startDateTime: start,
      endDateTime: end,
      type
    })
  }

  // Sort chronologically
  timeZones.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

  // 🩺 DEBUG: log all generated holiday zones
  console.log('=== holidayTimeZones (raw) ===')
  timeZones.forEach(z => {
    console.log(
      `${z.localName.padEnd(20)} | ${z.startDateTime.toLocaleString('no-NO')} → ${z.endDateTime.toLocaleString('no-NO')}`
    )
  })

  return timeZones
}

/**
 * Simple YYYY-MM-DD formatter
 */
export function formatDate(date: Date): string {
  if (!(date instanceof Date)) {
    throw new Error('formatDate expects a Date object, got: ' + date)
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Debug helper
 */
export function listHolidayTimeZones(year: number): void {
  const zones = getHolidayTimeZones(year)
  console.log(`\nNorwegian Holiday Time Zones ${year}\n`)
  zones.forEach(z => {
    console.log(
      `${z.localName.padEnd(25)} | ${z.type.padEnd(8)} | ${z.startDateTime.toLocaleString('no-NO')} → ${z.endDateTime.toLocaleString('no-NO')}`
    )
  })
}
