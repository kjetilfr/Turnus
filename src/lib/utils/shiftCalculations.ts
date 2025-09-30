// src/lib/utils/shiftCalculations.ts

/**
 * Calculate the duration of a shift in hours
 * Handles shifts that cross midnight
 */
export function calculateShiftHours(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0
  
  // Parse time strings (format: "HH:MM:SS")
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  
  // Convert to minutes
  const startMinutes = startHour * 60 + startMinute
  let endMinutes = endHour * 60 + endMinute
  
  // Handle shifts that cross midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }
  
  // Calculate duration in hours
  const durationMinutes = endMinutes - startMinutes
  return durationMinutes / 60
}

/**
 * Check if a shift crosses midnight
 */
export function shiftCrossesMidnight(startTime: string | null, endTime: string | null): boolean {
  if (!startTime || !endTime) return false
  
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  
  return endMinutes < startMinutes
}

/**
 * For shifts that cross midnight, calculate hours before midnight (previous day)
 */
export function calculateHoursBeforeMidnight(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0
  if (!shiftCrossesMidnight(startTime, endTime)) return 0
  
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const startMinutes = startHour * 60 + startMinute
  const midnightMinutes = 24 * 60
  
  // Hours from start time until midnight
  const minutesBeforeMidnight = midnightMinutes - startMinutes
  return minutesBeforeMidnight / 60
}

/**
 * For shifts that cross midnight, calculate hours after midnight (current day)
 */
export function calculateHoursAfterMidnight(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0
  if (!shiftCrossesMidnight(startTime, endTime)) return calculateShiftHours(startTime, endTime)
  
  const [endHour, endMinute] = endTime.split(':').map(Number)
  const endMinutes = endHour * 60 + endMinute
  
  // Hours from midnight until end time
  return endMinutes / 60
}

/**
 * Format hours for display
 */
export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`
}

/**
 * Calculate total hours for multiple shifts
 */
export function calculateTotalHours(shifts: Array<{ start_time: string | null, end_time: string | null }>): number {
  return shifts.reduce((total, shift) => {
    return total + calculateShiftHours(shift.start_time, shift.end_time)
  }, 0)
}