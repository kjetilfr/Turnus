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
 * Check if a date is a red day
 */
function isRedDay(dateStr: string, allHolidayDates: Set<string>): boolean {
  return allHolidayDates.has(dateStr)
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Get all Norwegian holiday time zones (AML-based windows)
 * Handles consecutive red days: when red days are back-to-back,
 * the second one starts at 22:00 (when the first one ends)
 */
export function getHolidayTimeZones(year: number): HolidayTimeZone[] {
  const holidays = getNorwegianHolidays(year)
  const timeZones: HolidayTimeZone[] = []
  
  // Create a set of all holiday dates for quick lookup
  const allHolidayDates = new Set(holidays.map(h => h.date))

  for (const h of holidays) {
    const date = makeLocalDate(h.date)
    const dayBefore = new Date(date)
    dayBefore.setDate(date.getDate() - 1)
    const dayBeforeStr = formatDate(dayBefore)

    let start: Date
    let end: Date
    let type: HolidayTimeZone['type']

    // Check if the day before is also a red day
    const previousDayIsRedDay = isRedDay(dayBeforeStr, allHolidayDates)

    if (previousDayIsRedDay) {
      // Previous day is a red day, so this one starts at 22:00 day before
      start = addHours(dayBefore, 22, 0)
      end = addHours(date, 22, 0)
      // Keep the type based on the current holiday's category
      if (isInCategory(h.name, HOLIDAY_CATEGORIES.MAY)) {
        type = 'may'
      } else if (isInCategory(h.name, HOLIDAY_CATEGORIES.SPECIAL)) {
        type = 'special'
      } else {
        type = 'standard'
      }
    } else {
      // Previous day is NOT a red day, use normal rules
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