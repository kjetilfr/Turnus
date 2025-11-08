import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'

/**
 * Calculate night hours between 20:00–06:00 (for 35.5h qualification)
 */
function calculateNightHours20to6(startTime: string, endTime: string): number {
  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const startMinutes = parseTime(startTime)
  let endMinutes = parseTime(endTime)

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const nightStart = 20 * 60 // 20:00
  const midnight = 24 * 60
  const nightEndAfterMidnight = 6 * 60 // 06:00

  let nightHours = 0

  // 20:00–24:00
  const period1Start = Math.max(startMinutes, nightStart)
  const period1End = Math.min(endMinutes, midnight)
  if (period1Start < period1End) {
    nightHours += (period1End - period1Start) / 60
  }

  // 00:00–06:00
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
 * Checks if the plan qualifies for 35.5h week based on:
 *  - average >= requiredNightHours of night work (20:00–06:00) per week OR
 *  - working at least 1 of every requiredSundayFrequency Sundays
 *
 * Returns detailed metrics for debugging and display.
 */
export function qualifiesFor35h(
  rotations: Rotation[],
  shifts: Shift[],
  actualWeeks: number,
  requiredNightHours = 1.39,
  sundaysWorked = 0,
  totalSundays = 0,
  requiredSundayFrequency = 3
): {
  qualifies: boolean
  meetsNightRequirement: boolean
  meetsSundayRequirement: boolean
  totalNightHours: number
  avgNightHoursPerWeek: number
  requiredNightHours: number
  sundaysWorked: number
  totalSundays: number
  requiredSundayFrequency: number
  workedFraction: number
  requiredFraction: number
} {
  // --- NIGHT HOURS CHECK ---
  let totalNightHours = 0

  rotations.forEach(rotation => {
    if (!rotation.shift_id) return
    const shift = shifts.find(s => s.id === rotation.shift_id)
    if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

    totalNightHours += calculateNightHours20to6(shift.start_time, shift.end_time)
  })

  const avgNightHoursPerWeek = actualWeeks > 0 ? totalNightHours / actualWeeks : 0
  const meetsNightRequirement = avgNightHoursPerWeek >= requiredNightHours

  // --- SUNDAY FREQUENCY CHECK ---
  const workedFraction = totalSundays > 0 ? sundaysWorked / totalSundays : 0
  const requiredFraction = 1 / requiredSundayFrequency
  const tolerance = 0.05

  const meetsSundayRequirement =
    workedFraction >= Math.max(0, requiredFraction - tolerance)

  // --- FINAL QUALIFICATION ---
  const qualifies = meetsNightRequirement || meetsSundayRequirement

  return {
    qualifies,
    meetsNightRequirement,
    meetsSundayRequirement,
    totalNightHours,
    avgNightHoursPerWeek,
    requiredNightHours,
    sundaysWorked,
    totalSundays,
    requiredSundayFrequency,
    workedFraction,
    requiredFraction
  }
}
