// src/lib/utils/shiftTimePeriods.ts

/**
 * Time period definitions for shift calculations
 */

export const TIME_PERIODS = {
  EVENING: {
    START: { hour: 17, minute: 0 }, // 17:00
    END: { hour: 21, minute: 0 },   // 21:00
  },
  // KS definerer 21:00-06:00 som natt i sin tariffavtale
  NIGHT_KS: {
    START: { hour: 21, minute: 0 }, // 21:00
    END: { hour: 6, minute: 0 },    // 06:00
  },
  // STATEN definerer 20:00-06:00 som natt i sin tariffavtale
  NIGHT_STATEN: {
    START: { hour: 20, minute: 0 }, // 20:00
    END: { hour: 6, minute: 0 },    // 06:00
  },
  // AML §10-11 bruker 21:00-06:00 for natt
  NIGHT_AML: {
    START: { hour: 21, minute: 0 }, // 21:00
    END: { hour: 6, minute: 0 },    // 06:00
  },
  // AML §10-11 bruker 21:00-06:00 for natt
  NIGHT_OSLO: {
    START: { hour: 21, minute: 0 }, // 21:00
    END: { hour: 6, minute: 0 },    // 06:00
  },
  WEEKEND: {
    START_DAY: 5, // Saturday (0 = Monday, 5 = Saturday)
    END_DAY: 6,   // Sunday (0 = Monday, 6 = Sunday)
  },
} as const

export type NightDefinition = 'ks' | 'staten' | 'aml' | 'oslo'

/**
 * Get night period definition based on tariffavtale
 */
export function getNightPeriodDefinition(tariffavtale: string): { start: number; end: number } {
  switch (tariffavtale) {
    case 'ks':
      return { start: TIME_PERIODS.NIGHT_KS.START.hour, end: TIME_PERIODS.NIGHT_KS.END.hour }
    case 'staten':
      return { start: TIME_PERIODS.NIGHT_STATEN.START.hour, end: TIME_PERIODS.NIGHT_STATEN.END.hour }
    case 'oslo':
      return { start: TIME_PERIODS.NIGHT_OSLO.START.hour, end: TIME_PERIODS.NIGHT_OSLO.END.hour }
    case 'aml':
      return { start: TIME_PERIODS.NIGHT_AML.START.hour, end: TIME_PERIODS.NIGHT_AML.END.hour }
    default:
      return { start: TIME_PERIODS.NIGHT_KS.START.hour, end: TIME_PERIODS.NIGHT_KS.END.hour }
  }
}

/**
 * Get night hours label based on tariffavtale
 */
export function getNightHoursLabel(tariffavtale: string): string {
  const period = getNightPeriodDefinition(tariffavtale)
  return `${period.start.toString().padStart(2, '0')}:00-${period.end.toString().padStart(2, '0')}:00`
}

export function getNightHoursCalculator(tariffavtale: string): (startTime: string | null, endTime: string | null) => number {
  switch (tariffavtale) {
    case 'ks':
      return calculateNightHoursKS // 21:00-06:00
    case 'staten':
      return calculateNightHoursStaten // 20:00-06:00
    case 'oslo':
      return calculateNightHoursOslo // 21:00-06:00
    case 'aml':
      return calculateNightHoursKS // Default to KS definition (21:00-06:00)
    default:
      return calculateNightHoursKS
  }
}


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
 * Calculate night hours using KS definition (21:00-06:00)
 * KS Tariffavtale standard definition
 */
export function calculateNightHoursKS(startTime: string | null, endTime: string | null): number {
  return calculateNightHoursByPeriod(startTime, endTime, TIME_PERIODS.NIGHT_KS)
}

/**
 * Calculate night hours using STATEN definition (20:00-06:00)
 * Statens tariffavtale definition
 */
export function calculateNightHoursStaten(startTime: string | null, endTime: string | null): number {
  return calculateNightHoursByPeriod(startTime, endTime, TIME_PERIODS.NIGHT_STATEN)
}

/**
 * Calculate night hours using AML definition (21:00-06:00)
 * Arbeidsmiljøloven § 10-8 definition for daily rest
 */
export function calculateNightHoursAML(startTime: string | null, endTime: string | null): number {
  return calculateNightHoursByPeriod(startTime, endTime, TIME_PERIODS.NIGHT_AML)
}

/**
 * Calculate night hours using Oslo Kommune definition (21:00-06:00)
 * Oslo Kommune standard definition
 */
export function calculateNightHoursOslo(startTime: string | null, endTime: string | null): number {
  return calculateNightHoursByPeriod(startTime, endTime, TIME_PERIODS.NIGHT_OSLO)
}

/**
 * Calculate night hours within a shift
 * Uses KS definition (21:00-06:00) by default for backward compatibility
 * @deprecated Use calculateNightHoursKS, calculateNightHoursStaten, calculateNightHoursAML, or calculateNightHoursOslo instead
 */
export function calculateNightHours(startTime: string | null, endTime: string | null): number {
  return calculateNightHoursKS(startTime, endTime)
}

/**
 * Helper function to calculate night hours based on a specific night period definition
 */
function calculateNightHoursByPeriod(
  startTime: string | null, 
  endTime: string | null,
  nightPeriod: { START: { hour: number; minute: number }; END: { hour: number; minute: number } }
): number {
  if (!startTime || !endTime) return 0

  const startMinutes = parseTimeToMinutes(startTime)
  let endMinutes = parseTimeToMinutes(endTime)
  
  // Handle shifts crossing midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const nightStart = timeToMinutes(nightPeriod.START.hour, nightPeriod.START.minute)
  const nightEndAfterMidnight = timeToMinutes(nightPeriod.END.hour, nightPeriod.END.minute)
  const midnight = 24 * 60

  let nightHours = 0

  // Period 1: nightStart to midnight (if shift includes this)
  const period1Start = Math.max(startMinutes, nightStart)
  const period1End = Math.min(endMinutes, midnight)
  if (period1Start < period1End) {
    nightHours += (period1End - period1Start) / 60
  }

  // Period 2: midnight to nightEnd (if shift includes this)
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
  
  const startMinutes = parseTimeToMinutes(startTime)
  let endMinutes = parseTimeToMinutes(endTime)
  
  // Check if this is a night shift (crosses midnight)
  const isNightShift = endMinutes < startMinutes
  
  // Handle shifts crossing midnight
  if (isNightShift) {
    endMinutes += 24 * 60
  }

  // Special case: Monday night shift (shown on Monday but starts Sunday)
  if (dayOfWeek === 0 && isNightShift) {
    // This shift starts on Sunday (day 6), so all hours before midnight are weekend hours
    const hoursBeforeMidnight = (24 * 60 - startMinutes) / 60
    return hoursBeforeMidnight
  }
  
  // Regular weekend days (Saturday and Sunday)
  if (isWeekendDay(dayOfWeek)) {
    // For weekend days, all hours in the shift count as weekend hours
    const totalMinutes = endMinutes - startMinutes
    return totalMinutes / 60
  }

  // Not a weekend day
  return 0
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