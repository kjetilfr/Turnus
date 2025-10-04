// src/lib/utils/norwegianHolidayTimeZones.ts

/**
 * Norwegian Holiday Time Zones
 * 
 * In Norwegian labor law, holidays have special time zones where different 
 * compensation rates apply. This utility helps calculate which hours fall 
 * within these special holiday periods.
 * 
 * Legal Reference: AML § 10-10 (1) - Søn- og helgedagsarbeid
 * https://lovdata.no/lov/2005-06-17-62/§10-10
 */

import { getNorwegianHolidays } from './norwegianHolidays'

export interface HolidayTimeZone {
  holidayName: string
  localName: string
  startDateTime: Date
  endDateTime: Date
  type: 'full_day' | 'eve' | 'special'
}

/**
 * Norwegian Holiday Time Zone Rules (AML § 10-10):
 * 
 * 1. Labour Day (1st May) and Constitution Day (17th May):
 *    22:00 day before → 22:00 day of
 * 
 * 2. Most holidays (New Year's Day, Maundy Thursday, Good Friday, 
 *    Easter Monday, Whit Monday, St. Stephen's Day) and Sundays:
 *    18:00 day before → 22:00 day of
 *    (Unless preceded by another holiday, then 22:00 day before → 22:00 day of)
 * 
 * 3. Special holidays (Easter Sunday, Whit Sunday, Christmas Day):
 *    15:00 day before → 22:00 day of
 */

export const HOLIDAY_CATEGORIES = {
  // 22:00 day before → 22:00 day of
  MAJOR: ['Labour Day', 'Constitution Day'],
  
  // 15:00 day before → 22:00 day of
  SPECIAL: ['Easter Sunday', 'Whit Sunday', 'Christmas Day'],
  
  // 18:00 day before → 22:00 day of (unless preceded by another holiday)
  STANDARD: [
    "New Year's Day",
    'Maundy Thursday',
    'Good Friday',
    'Easter Monday',
    'Whit Monday',
    "St. Stephen's Day"
  ]
} as const

/**
 * Sunday Time Zone Definition (AML § 10-10 (1))
 * Regular Sundays (not special holidays): Saturday 18:00 → Sunday 22:00
 * 
 * Legal Reference: Arbeidsmiljøloven § 10-10 (1) - Søn- og helgedagsarbeid
 * https://lovdata.no/lov/2005-06-17-62/§10-10
 */
export const SUNDAY_TIME_ZONE = {
  START_DAY: 5, // Saturday
  START_HOUR: 18,
  START_MINUTE: 0,
  END_DAY: 6, // Sunday
  END_HOUR: 22,
  END_MINUTE: 0
} as const

/**
 * Get all holiday time zones for a specific year
 */
export function getHolidayTimeZones(year: number): HolidayTimeZone[] {
  const holidays = getNorwegianHolidays(year)
  const timeZones: HolidayTimeZone[] = []

  // Add fixed date holidays
  holidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date)
    
    // Full day holidays (00:00 to 24:00 on the holiday itself)
    timeZones.push({
      holidayName: holiday.name,
      localName: holiday.localName,
      startDateTime: new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate(), 0, 0),
      endDateTime: new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate(), 23, 59, 59),
      type: 'full_day'
    })
  })

  // Christmas Eve (Dec 24)
  timeZones.push({
    holidayName: "Christmas Eve",
    localName: "Julaften",
    startDateTime: new Date(year, 11, 24, 0, 0),
    endDateTime: new Date(year, 11, 24, 23, 59, 59),
    type: 'full_day'
  })

  // New Year's Eve (Dec 31)
  timeZones.push({
    holidayName: "New Year's Eve",
    localName: "Nyttårsaften",
    startDateTime: new Date(year, 11, 31, 0, 0),
    endDateTime: new Date(year, 11, 31, 23, 59, 59),
    type: 'full_day'
  })

  // Eve periods (18:00 to 24:00 on the day before)
  
  // Maundy Thursday evening (already a holiday, but special rate after 18:00)
  const maundyThursday = holidays.find(h => h.name === "Maundy Thursday")
  if (maundyThursday) {
    const date = new Date(maundyThursday.date)
    timeZones.push({
      holidayName: "Maundy Thursday Evening",
      localName: "Skjærtorsdag kveld",
      startDateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0),
      endDateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
      type: 'eve'
    })
  }

  // Constitution Day Eve (May 16, 18:00 to 24:00)
  timeZones.push({
    holidayName: "Constitution Day Eve",
    localName: "Kvelden før 17. mai",
    startDateTime: new Date(year, 4, 16, 18, 0),
    endDateTime: new Date(year, 4, 16, 23, 59, 59),
    type: 'eve'
  })

  // Ascension Day Eve (day before Ascension, 18:00 to 24:00)
  const ascensionDay = holidays.find(h => h.name === "Ascension Day")
  if (ascensionDay) {
    const date = new Date(ascensionDay.date)
    const dayBefore = new Date(date)
    dayBefore.setDate(dayBefore.getDate() - 1)
    
    timeZones.push({
      holidayName: "Ascension Day Eve",
      localName: "Kvelden før Kristi himmelfartsdag",
      startDateTime: new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate(), 18, 0),
      endDateTime: new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate(), 23, 59, 59),
      type: 'eve'
    })
  }

  // Sort by start date
  timeZones.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

  return timeZones
}

/**
 * Get all Sunday time zones for a year (regular Sundays, not special holidays)
 * Returns time zones for Saturday 18:00 - Sunday 22:00 for each week
 */
export function getSundayTimeZones(year: number, startDate?: string, durationWeeks?: number): HolidayTimeZone[] {
  const timeZones: HolidayTimeZone[] = []
  
  // If specific date range provided, use that; otherwise do whole year
  const start = startDate ? new Date(startDate) : new Date(year, 0, 1)
  const weeks = durationWeeks || 52
  
  for (let week = 0; week < weeks; week++) {
    const weekStart = new Date(start)
    weekStart.setDate(weekStart.getDate() + (week * 7))
    
    // Find the Saturday and Sunday of this week
    // Assuming week starts on Monday (day 0)
    const saturday = new Date(weekStart)
    saturday.setDate(saturday.getDate() + SUNDAY_TIME_ZONE.START_DAY)
    
    const sunday = new Date(weekStart)
    sunday.setDate(sunday.getDate() + SUNDAY_TIME_ZONE.END_DAY)
    
    // Sunday zone: Saturday 18:00 - Sunday 22:00
    const zoneStart = new Date(saturday)
    zoneStart.setHours(SUNDAY_TIME_ZONE.START_HOUR, SUNDAY_TIME_ZONE.START_MINUTE, 0, 0)
    
    const zoneEnd = new Date(sunday)
    zoneEnd.setHours(SUNDAY_TIME_ZONE.END_HOUR, SUNDAY_TIME_ZONE.END_MINUTE, 0, 0)
    
    timeZones.push({
      holidayName: 'Sunday',
      localName: 'Søndag',
      startDateTime: zoneStart,
      endDateTime: zoneEnd,
      type: 'full_day'
    })
  }
  
  return timeZones
}

/**
 * Check if a specific date and time falls within a holiday time zone
 */
export function isInHolidayTimeZone(
  dateTime: Date,
  year?: number
): { isHoliday: boolean; zone?: HolidayTimeZone } {
  const checkYear = year || dateTime.getFullYear()
  const timeZones = getHolidayTimeZones(checkYear)

  for (const zone of timeZones) {
    if (dateTime >= zone.startDateTime && dateTime <= zone.endDateTime) {
      return { isHoliday: true, zone }
    }
  }

  return { isHoliday: false }
}

/**
 * Calculate holiday hours for a shift on a specific date
 * 
 * @param shiftDate - The date of the shift (YYYY-MM-DD)
 * @param startTime - Start time (HH:MM:SS)
 * @param endTime - End time (HH:MM:SS)
 * @returns Hours worked during holiday time zones
 */
export function calculateHolidayHours(
  shiftDate: string,
  startTime: string,
  endTime: string
): {
  totalHolidayHours: number
  holidayBreakdown: Array<{
    holidayName: string
    localName: string
    hours: number
    type: 'full_day' | 'eve' | 'special'
  }>
} {
  const [year, month, day] = shiftDate.split('-').map(Number)
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  // Create start datetime
  const shiftStart = new Date(year, month - 1, day, startHour, startMin)
  
  // Create end datetime (handle crossing midnight)
  const shiftEnd = new Date(year, month - 1, day, endHour, endMin)
  if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
    shiftEnd.setDate(shiftEnd.getDate() + 1)
  }

  // Get all holiday time zones for relevant years
  const timeZones = [
    ...getHolidayTimeZones(year),
    ...getHolidayTimeZones(year + 1) // In case shift crosses into next year
  ]

  const holidayBreakdown: Array<{
    holidayName: string
    localName: string
    hours: number
    type: 'full_day' | 'eve' | 'special'
  }> = []

  let totalHolidayHours = 0

  // Check each holiday time zone for overlap with the shift
  for (const zone of timeZones) {
    // Calculate overlap between shift and holiday zone
    const overlapStart = shiftStart > zone.startDateTime ? shiftStart : zone.startDateTime
    const overlapEnd = shiftEnd < zone.endDateTime ? shiftEnd : zone.endDateTime

    if (overlapStart < overlapEnd) {
      const overlapMillis = overlapEnd.getTime() - overlapStart.getTime()
      const overlapHours = overlapMillis / (1000 * 60 * 60)
      
      totalHolidayHours += overlapHours
      
      holidayBreakdown.push({
        holidayName: zone.holidayName,
        localName: zone.localName,
        hours: overlapHours,
        type: zone.type
      })
    }
  }

  return {
    totalHolidayHours,
    holidayBreakdown
  }
}

/**
 * Get a list of all holiday dates for a year (useful for calendar marking)
 */
export function getHolidayDates(year: number): string[] {
  const timeZones = getHolidayTimeZones(year)
  const dates = new Set<string>()

  timeZones.forEach(zone => {
    const date = zone.startDateTime.toISOString().split('T')[0]
    dates.add(date)
  })

  return Array.from(dates).sort()
}

/**
 * Format holiday hours breakdown for display
 */
export function formatHolidayBreakdown(
  breakdown: Array<{
    holidayName: string
    localName: string
    hours: number
    type: 'full_day' | 'eve' | 'special'
  }>
): string {
  if (breakdown.length === 0) return 'No holiday hours'

  return breakdown
    .map(item => `${item.localName}: ${item.hours.toFixed(2)}h`)
    .join(', ')
}