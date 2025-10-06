// src/lib/utils/shiftTimePeriods.ts

/**
 * Time period definitions for shift calculations
 */

export const TIME_PERIODS = {
  EVENING: {
    START: { hour: 17, minute: 0 }, // 17:00
    END: { hour: 21, minute: 0 },   // 21:00
  },
  //KS definerer 21:00-06:00 som natt i sin tariffavtale
  NIGHT_KS: {
    START: { hour: 21, minute: 0 }, // 21:00
    END: { hour: 6, minute: 0 },    // 06:00
  },
  //STATEN definerer 20:00-06:00 som natt i sin tariffavtale
  NIGHT_STATEN: {
    START: { hour: 20, minute: 0 }, // 20:00
    END: { hour: 6, minute: 0 },    // 06:00
  },
  WEEKEND: {
    START_DAY: 5, // Saturday (0 = Monday, 5 = Saturday)
    END_DAY: 6,   // Sunday (0 = Monday, 6 = Sunday)
  },
} as const

/**
 * Convert time to minutes since midnight
 */
function timeToMinutes(hour: number, minute: number): number {
  return hour * 60 + minute
}

/**
 * Parse time string (HH:MM:SS or HH:MM) to minutes
 */
function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return timeToMinutes(hour, minute)
}

/**
 * Calculate evening hours within a shift
 * Evening hours are from 17:00 to 21:00
 */
export function calculateEveningHours(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0

  const startMinutes = parseTimeToMinutes(startTime)
  let endMinutes = parseTimeToMinutes(endTime)
  
  // Handle shifts crossing midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const eveningStart = timeToMinutes(TIME_PERIODS.EVENING.START.hour, TIME_PERIODS.EVENING.START.minute)
  const eveningEnd = timeToMinutes(TIME_PERIODS.EVENING.END.hour, TIME_PERIODS.EVENING.END.minute)

  // Find overlap between shift and evening period
  const overlapStart = Math.max(startMinutes, eveningStart)
  const overlapEnd = Math.min(endMinutes, eveningEnd)

  if (overlapStart < overlapEnd) {
    return (overlapEnd - overlapStart) / 60
  }

  return 0
}

/**
 * Calculate night hours within a shift
 * Night hours are from 21:00 to 06:00
 * This spans across midnight, so we need to check two periods:
 * - 21:00 to 24:00 (before midnight)
 * - 00:00 to 06:00 (after midnight)
 */
export function calculateNightHours(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0

  const startMinutes = parseTimeToMinutes(startTime)
  let endMinutes = parseTimeToMinutes(endTime)
  
  // Handle shifts crossing midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const nightStart = timeToMinutes(TIME_PERIODS.NIGHT_KS.START.hour, TIME_PERIODS.NIGHT_KS.START.minute)
  const nightEndAfterMidnight = timeToMinutes(TIME_PERIODS.NIGHT_KS.END.hour, TIME_PERIODS.NIGHT_KS.END.minute)
  const midnight = 24 * 60

  let nightHours = 0

  // Period 1: 21:00 to midnight (if shift includes this)
  const period1Start = Math.max(startMinutes, nightStart)
  const period1End = Math.min(endMinutes, midnight)
  if (period1Start < period1End) {
    nightHours += (period1End - period1Start) / 60
  }

  // Period 2: midnight to 06:00 (if shift includes this)
  if (endMinutes > midnight) {
    const period2Start = Math.max(startMinutes, midnight)
    const period2End = Math.min(endMinutes, midnight + nightEndAfterMidnight)
    if (period2Start < period2End) {
      nightHours += (period2End - period2Start) / 60
    }
  }

  return nightHours
}

/**
 * Check if a specific day is a weekend day
 * @param dayOfWeek - 0 = Monday, 6 = Sunday
 */
export function isWeekendDay(dayOfWeek: number): boolean {
  return dayOfWeek === TIME_PERIODS.WEEKEND.START_DAY || dayOfWeek === TIME_PERIODS.WEEKEND.END_DAY
}

/**
 * Calculate weekend hours for a shift on a specific day
 * Weekend is Saturday 00:00 to Sunday 24:00
 * @param dayOfWeek - 0 = Monday, 6 = Sunday
 */
export function calculateWeekendHours(
  startTime: string | null, 
  endTime: string | null, 
  dayOfWeek: number
): number {
  if (!startTime || !endTime) return 0
  
  // Only Saturday and Sunday count as weekend
  if (!isWeekendDay(dayOfWeek)) return 0

  // For weekend days, all hours in the shift count as weekend hours
  const startMinutes = parseTimeToMinutes(startTime)
  let endMinutes = parseTimeToMinutes(endTime)
  
  // Handle shifts crossing midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const totalMinutes = endMinutes - startMinutes
  return totalMinutes / 60
}

/**
 * Get a summary of all special hours in a shift
 */
export function getShiftPeriodSummary(
  startTime: string | null, 
  endTime: string | null,
  dayOfWeek: number
): {
  eveningHours: number
  nightHours: number
  weekendHours: number
  regularHours: number
  totalHours: number
} {
  const eveningHours = calculateEveningHours(startTime, endTime)
  const nightHours = calculateNightHours(startTime, endTime)
  const weekendHours = calculateWeekendHours(startTime, endTime, dayOfWeek)
  
  // Calculate total hours
  const startMinutes = parseTimeToMinutes(startTime || '00:00')
  let endMinutes = parseTimeToMinutes(endTime || '00:00')
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }
  const totalHours = (endMinutes - startMinutes) / 60

  // Regular hours = total - (evening + night)
  // Note: Weekend hours can overlap with evening/night, so we don't subtract them
  const regularHours = Math.max(0, totalHours - eveningHours - nightHours)

  return {
    eveningHours,
    nightHours,
    weekendHours,
    regularHours,
    totalHours,
  }
}

/**
 * Format hours breakdown for display
 */
export function formatHoursBreakdown(summary: ReturnType<typeof getShiftPeriodSummary>): string {
  const parts: string[] = []
  
  if (summary.regularHours > 0) {
    parts.push(`${summary.regularHours.toFixed(1)}h regular`)
  }
  if (summary.eveningHours > 0) {
    parts.push(`${summary.eveningHours.toFixed(1)}h evening`)
  }
  if (summary.nightHours > 0) {
    parts.push(`${summary.nightHours.toFixed(1)}h night`)
  }
  if (summary.weekendHours > 0) {
    parts.push(`${summary.weekendHours.toFixed(1)}h weekend`)
  }

  return parts.join(', ') || '0h'
}