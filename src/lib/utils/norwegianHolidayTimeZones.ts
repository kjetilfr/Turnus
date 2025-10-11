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
  MAY: ['Labour Day', 'Constitution Day'],
  SPECIAL: ['Easter Sunday', 'Whit Sunday', 'Christmas Day'],
  SECOND_DAY: ['Easter Monday', 'Whit Monday', "St. Stephen's Day"]
} as const satisfies Record<string, readonly string[]>

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

    if (HOLIDAY_CATEGORIES.MAY.includes(h.name as any)) {
      // 22:00 day before → 22:00 day of
      start = addHours(dayBefore, 22, 0)
      end = addHours(date, 22, 0)
      type = 'may'
    } else if (HOLIDAY_CATEGORIES.SPECIAL.includes(h.name as any)) {
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
