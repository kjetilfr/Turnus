// src/lib/utils/norwegianHolidayTimeZones.ts

/**
 * Norwegian Holiday Time Zones
 * 
 * In Norwegian labor law, holidays have special time zones where different 
 * compensation rates apply. This utility helps calculate which hours fall 
 * within these special holiday periods.
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
 * Norwegian Holiday Time Zone Rules:
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

const HOLIDAY_CATEGORIES = {
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