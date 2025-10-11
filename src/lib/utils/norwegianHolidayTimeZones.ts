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

// Create a type-safe helper to check if a holiday name is in a category
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
 * Helper: make local Date safely (avoids UTC shift)
 */
function makeLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Helper: add hours/minutes to a Date (returns new instance)
 */
function addHours(date: Date, hours: number, minutes = 0): Date {
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Get all Norwegian holiday time zones (AML-based windows)
 */
export function getHolidayTimeZones(year: number): HolidayTimeZone[] {
  const holidays = getNorwegianHolidays(year)
  const timeZones: HolidayTimeZone[] = []

  for (const h of holidays) {
    const date = makeLocalDate(h.date)
    const dayBefore = new Date(date)
    dayBefore.setDate(date.getDate() - 1)

    let start: Date
    let end: Date
    let type: HolidayTimeZone['type']

    if (isInCategory(h.name, HOLIDAY_CATEGORIES.MAY)) {
      // 22:00 day before → 22:00 day of
      start = addHours(dayBefore, 22, 0)
      end = addHours(date, 22, 0)
      type = 'may'
    } else if (isInCategory(h.name, HOLIDAY_CATEGORIES.SPECIAL)) {
      // 15:00 day before → 22:00 day of
      start = addHours(dayBefore, 15, 0)
      end = addHours(date, 22, 0)
      type = 'special'
    } else {
      // Standard: 18:00 day before → 22:00 day of
      start = addHours(dayBefore, 18, 0)
      end = addHours(date, 22, 0)
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

  return timeZones
}

/**
 * Helper for debug output
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
