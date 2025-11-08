import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'
import { 
  getRotationDate, 
  formatDateLocal, 
  calculateTimeZoneOverlap
} from '@/lib/lawChecks/ThreeSplitAverage/ThreeSplitAverageUtils'

/**
 * Check vacation (FE) overlays and calculate their impact on holiday/Sunday zones AND night hours
 * 
 * SIMPLIFIED: The night/holiday overlap logic is now handled in the main ThreeSplitAverageCheck,
 * so this function just calculates the raw hours to subtract from both totals.
 */
export function checkVacationOverlays(
  rotations: Rotation[],
  shifts: Shift[],
  zones: HolidayTimeZone[],
  planStartDate: Date,
  tariffavtale: string,
  calculateNightHours: (startTime: string, endTime: string) => number
): {
  overlayDays: Array<{
    type: string
    week: number
    day: number
    date: string
    underlyingShift: string
    hours: number
  }>
  hoursToSubtractHoliday: number
  hoursToSubtractNight: number
  count: number
} {
  const overlayDays: Array<{
    type: string
    week: number
    day: number
    date: string
    underlyingShift: string
    hours: number
  }> = []

  let hoursToSubtractHoliday = 0
  let hoursToSubtractNight = 0

  rotations.forEach(rotation => {
    if (!rotation.overlay_shift_id) return
    
    const overlayShift = shifts.find(s => s.id === rotation.overlay_shift_id)
    if (!overlayShift || overlayShift.name !== 'FE' || !overlayShift.is_default) return

    const underlyingShift = rotation.shift_id 
      ? shifts.find(s => s.id === rotation.shift_id)
      : null
    
    const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)
    
    let underlayHours = 0
    if (underlyingShift && underlyingShift.start_time && underlyingShift.end_time) {
      underlayHours = calculateShiftHours(underlyingShift.start_time, underlyingShift.end_time)
    }
    
    overlayDays.push({
      type: overlayShift.name,
      week: rotation.week_index + 1,
      day: rotation.day_of_week,
      date: formatDateLocal(rotationDate),
      underlyingShift: underlyingShift ? underlyingShift.name : 'None',
      hours: underlayHours
    })
    
    // Calculate hours to subtract from both holiday and night totals
    if (underlyingShift && underlyingShift.start_time && underlyingShift.end_time) {
      // Calculate total night hours in this shift (to subtract from night total)
      const nightHoursInShift = calculateNightHours(underlyingShift.start_time, underlyingShift.end_time)
      
      // Calculate holiday zone overlap (total hours in zones)
      let holidayOverlapInShift = 0
      
      zones.forEach(zone => {
        const zoneOverlap = calculateTimeZoneOverlap(rotation, underlyingShift, zone, planStartDate)
        if (zoneOverlap > 0) {
          holidayOverlapInShift += zoneOverlap
        }
      })
      
      // Subtract ALL night hours from the shift (regardless of zone)
      hoursToSubtractNight += nightHoursInShift
      
      // Subtract ALL holiday hours (the night/holiday overlap is handled in main check)
      hoursToSubtractHoliday += holidayOverlapInShift
    }
  })

  return {
    overlayDays,
    hoursToSubtractHoliday,
    hoursToSubtractNight,
    count: overlayDays.length
  }
}