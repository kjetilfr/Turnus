import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'
import { getNightPeriodDefinition } from '@/lib/utils/shiftTimePeriods'

/**
 * Helper to get date for a rotation
 */
export function getRotationDate(planStartDate: Date, weekIndex: number, dayOfWeek: number): Date {
  const d = new Date(planStartDate)
  const jsDay = d.getDay()
  const mondayFirstIndex = (jsDay + 6) % 7
  d.setDate(d.getDate() - mondayFirstIndex)
  d.setDate(d.getDate() + (weekIndex * 7) + dayOfWeek)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Adjust holiday zone end times to stop at night start
 * This prevents overlap between holiday hours and night hours
 */
export function adjustHolidayZonesForNightStart(
  zones: HolidayTimeZone[],
  tariffavtale: string
): HolidayTimeZone[] {
  const nightPeriod = getNightPeriodDefinition(tariffavtale)
  const nightStartHour = nightPeriod.start

  console.log(`\n🔧 Adjusting holiday zones to end at night start (${nightStartHour}:00)`)

  return zones.map(zone => {
    const zoneEnd = new Date(zone.endDateTime)
    const zoneEndDate = new Date(zoneEnd)
    zoneEndDate.setHours(0, 0, 0, 0)
    
    // Check if zone extends into night hours on its end date
    const nightStartOnEndDate = new Date(zoneEndDate)
    nightStartOnEndDate.setHours(nightStartHour, 0, 0, 0)
    
    // If zone ends after night starts on the same day, cap it at night start
    if (zoneEnd > nightStartOnEndDate) {
      console.log(`   ${zone.holidayName}: ${formatDateLocal(zone.endDateTime)} ${zoneEnd.getHours()}:${zoneEnd.getMinutes().toString().padStart(2, '0')} → ${nightStartHour}:00`)
      return {
        ...zone,
        endDateTime: nightStartOnEndDate
      }
    }
    
    return zone
  })
}

/**
 * Merge overlapping time zones that actually overlap in time.
 * When Sunday and a holiday (e.g., Constitution Day on Sunday) overlap,
 * we should only count it once - using the merged zone.
 * 
 * IMPORTANT: When merging, we take:
 * - The EARLIEST start time (to capture full extent)
 * - The EARLIEST end time (to respect the shortest zone boundary)
 * 
 * This ensures that if Constitution Day ends at 22:00 and Sunday extends to 23:59,
 * the merged zone ends at 22:00 (the holiday ends, then 22:00-23:59 becomes night, not holiday).
 */
export function mergeOverlappingTimeZones(zones: HolidayTimeZone[]): HolidayTimeZone[] {
  if (zones.length === 0) return []

  const sorted = [...zones].sort(
    (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
  )

  const merged: HolidayTimeZone[] = []

  for (const zone of sorted) {
    // Find if this zone overlaps with any existing merged zone
    const overlapIndex = merged.findIndex(existing => {
      // Two zones overlap if one starts before the other ends
      const overlap = 
        existing.startDateTime < zone.endDateTime && 
        zone.startDateTime < existing.endDateTime
      return overlap
    })

    if (overlapIndex === -1) {
      // No overlap → add as new zone
      merged.push({ ...zone })
      continue
    }

    // Overlaps with existing zone → merge them
    const existing = merged[overlapIndex]
    
    // Take EARLIEST start (to capture full extent)
    const mergedStart = existing.startDateTime < zone.startDateTime 
      ? existing.startDateTime 
      : zone.startDateTime
    
    // Take EARLIEST end (to respect the shortest boundary)
    // This ensures Constitution Day ending at 22:00 doesn't get extended to 23:59
    const mergedEnd = existing.endDateTime < zone.endDateTime 
      ? existing.endDateTime 
      : zone.endDateTime

    merged[overlapIndex] = {
      holidayName:
        existing.holidayName !== zone.holidayName
          ? `${existing.holidayName} + ${zone.holidayName}`
          : existing.holidayName,
      localName:
        existing.localName !== zone.localName
          ? `${existing.localName} + ${zone.localName}`
          : existing.localName,
      startDateTime: mergedStart,
      endDateTime: mergedEnd,
      type: existing.type,
    }
  }

  // Keep chronological order
  merged.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

  return merged
}


/**
 * Create Sunday time zones as TWO separate zones per weekend:
 * - Saturday zone: Saturday 18:00 → Saturday [nightStart or 24:00]
 * - Sunday zone: Sunday [nightEnd or 00:00] → Sunday [nightStart or 24:00]
 * 
 * @param applyNightBoundaries - If true, zones end at night start. If false, zones extend to full day (for later merging)
 * 
 * Examples when applyNightBoundaries=true:
 * - KS: Sat 18:00-21:00, Sun 06:00-21:00 (night 21:00-06:00)
 * - STATEN: Sat 18:00-20:00, Sun 06:00-20:00 (night 20:00-06:00)
 * 
 * When applyNightBoundaries=false (for merging first):
 * - Sat 18:00-24:00, Sun 00:00-24:00 (full coverage, will be adjusted after merge)
 */
export function createSundayTimeZones(
  startDate: Date, 
  endDate: Date, 
  tariffavtale: string,
  applyNightBoundaries: boolean = true
): HolidayTimeZone[] {
  const zones: HolidayTimeZone[] = []
  const current = new Date(startDate)

  // Get when night begins and ends for this tariffavtale
  const nightPeriod = getNightPeriodDefinition(tariffavtale)
  const nightStartHour = nightPeriod.start
  const nightEndHour = nightPeriod.end

  console.log(`📅 Creating Sunday zones with tariffavtale: ${tariffavtale}`)
  console.log(`   Night period: ${nightStartHour}:00 - ${nightEndHour}:00`)
  
  if (applyNightBoundaries) {
    console.log(`   Saturday zone: 18:00 - ${nightStartHour}:00`)
    console.log(`   Sunday zone: ${nightEndHour}:00 - ${nightStartHour}:00`)
  } else {
    console.log(`   Saturday zone: 18:00 - 24:00 (full coverage for merging)`)
    console.log(`   Sunday zone: 00:00 - 24:00 (full coverage for merging)`)
  }

  // Move to first Sunday on/after startDate
  while (current.getDay() !== 0) {
    current.setDate(current.getDate() + 1)
  }

  while (current <= endDate) {
    const sunday = new Date(current)
    const saturday = new Date(current)
    saturday.setDate(saturday.getDate() - 1)

    // SATURDAY ZONE: Saturday 18:00 → end time (depends on applyNightBoundaries)
    const saturdayZoneStart = new Date(saturday)
    saturdayZoneStart.setHours(18, 0, 0, 0)
    
    const saturdayZoneEnd = new Date(saturday)
    if (applyNightBoundaries) {
      saturdayZoneEnd.setHours(nightStartHour, 0, 0, 0)
    } else {
      saturdayZoneEnd.setHours(23, 59, 59, 999) // End of Saturday
    }

    if (saturdayZoneEnd >= startDate && saturdayZoneStart <= endDate) {
      zones.push({
        holidayName: 'Sunday',
        localName: 'Lørdag (Søndag)',
        startDateTime: saturdayZoneStart,
        endDateTime: saturdayZoneEnd,
        type: 'standard'
      })
      
      if (applyNightBoundaries) {
        console.log(`   Created Saturday zone: ${formatDateLocal(saturdayZoneStart)} 18:00 - ${formatDateLocal(saturdayZoneEnd)} ${nightStartHour}:00`)
      }
    }

    // SUNDAY ZONE: Sunday start time → end time (depends on applyNightBoundaries)
    const sundayZoneStart = new Date(sunday)
    if (applyNightBoundaries) {
      sundayZoneStart.setHours(nightEndHour, 0, 0, 0)
    } else {
      sundayZoneStart.setHours(0, 0, 0, 0) // Start of Sunday
    }
    
    const sundayZoneEnd = new Date(sunday)
    if (applyNightBoundaries) {
      sundayZoneEnd.setHours(nightStartHour, 0, 0, 0)
    } else {
      sundayZoneEnd.setHours(23, 59, 59, 999) // End of Sunday
    }

    if (sundayZoneEnd >= startDate && sundayZoneStart <= endDate) {
      zones.push({
        holidayName: 'Sunday',
        localName: 'Søndag',
        startDateTime: sundayZoneStart,
        endDateTime: sundayZoneEnd,
        type: 'standard'
      })
      
      if (applyNightBoundaries) {
        console.log(`   Created Sunday zone: ${formatDateLocal(sundayZoneStart)} ${nightEndHour}:00 - ${formatDateLocal(sundayZoneEnd)} ${nightStartHour}:00`)
      }
    }

    current.setDate(current.getDate() + 7)
  }

  console.log(`   Total Sunday zones created: ${zones.length}`)
  return zones
}

/**
 * Format date as YYYY-MM-DD in local timezone
 */
export function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
}

/**
 * Calculate overlap between a rotation/shift and a time zone
 */
export function calculateTimeZoneOverlap(
  rotation: Rotation,
  shift: Shift,
  zone: HolidayTimeZone,
  planStartDate: Date
): number {
  if (!shift.start_time || !shift.end_time) return 0

  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return { hour: h, minute: m }
  }

  const startTime = parseTime(shift.start_time)
  const endTime = parseTime(shift.end_time)

  const isNightShift =
    endTime.hour < startTime.hour ||
    (endTime.hour === startTime.hour && endTime.minute < startTime.minute)

  const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)

  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  if (rotation.day_of_week === 6 && isNightShift) {
    const saturday = new Date(rotationDate)
    saturday.setDate(saturday.getDate() - 1)

    shiftStartDateTime = new Date(saturday)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else if (isNightShift) {
    const prevDay = new Date(rotationDate)
    prevDay.setDate(prevDay.getDate() - 1)

    shiftStartDateTime = new Date(prevDay)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else {
    shiftStartDateTime = new Date(rotationDate)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  }

  const overlapStart = shiftStartDateTime > zone.startDateTime
    ? shiftStartDateTime
    : zone.startDateTime

  const overlapEnd = shiftEndDateTime < zone.endDateTime
    ? shiftEndDateTime
    : zone.endDateTime

  if (overlapStart < overlapEnd) {
    const overlapMillis = overlapEnd.getTime() - overlapStart.getTime()
    return overlapMillis / (1000 * 60 * 60)
  }

  return 0
}

/**
 * Calculate night hours that fall within a specific holiday/Sunday zone
 * Used to avoid double-counting hours that qualify for both night credit (0.25) and holiday credit (10/60)
 */
export function calculateNightHoursInZone(
  rotation: Rotation,
  shift: Shift,
  zone: HolidayTimeZone,
  planStartDate: Date,
  tariffavtale: string
): number {
  if (!shift.start_time || !shift.end_time) return 0

  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return { hour: h, minute: m }
  }

  const startTime = parseTime(shift.start_time)
  const endTime = parseTime(shift.end_time)

  const isNightShift =
    endTime.hour < startTime.hour ||
    (endTime.hour === startTime.hour && endTime.minute < startTime.minute)

  const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)

  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  if (rotation.day_of_week === 6 && isNightShift) {
    const saturday = new Date(rotationDate)
    saturday.setDate(saturday.getDate() - 1)

    shiftStartDateTime = new Date(saturday)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else if (isNightShift) {
    const prevDay = new Date(rotationDate)
    prevDay.setDate(prevDay.getDate() - 1)

    shiftStartDateTime = new Date(prevDay)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else {
    shiftStartDateTime = new Date(rotationDate)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  }

  const nightPeriod = getNightPeriodDefinition(tariffavtale)
  
  const nightStartToday = new Date(shiftStartDateTime)
  nightStartToday.setHours(nightPeriod.start, 0, 0, 0)
  
  const nightEndToday = new Date(shiftStartDateTime)
  nightEndToday.setHours(nightPeriod.end, 0, 0, 0)
  if (nightPeriod.end < nightPeriod.start) {
    nightEndToday.setDate(nightEndToday.getDate() + 1)
  }

  const nightStartYesterday = new Date(nightStartToday)
  nightStartYesterday.setDate(nightStartYesterday.getDate() - 1)
  
  const nightEndYesterday = new Date(nightEndToday)
  nightEndYesterday.setDate(nightEndYesterday.getDate() - 1)

  let totalNightInZone = 0

  const zoneStart = zone.startDateTime
  const zoneEnd = zone.endDateTime

  const calculateTripleOverlap = (nightStart: Date, nightEnd: Date) => {
    const overlapStart = new Date(Math.max(
      shiftStartDateTime.getTime(),
      zoneStart.getTime(),
      nightStart.getTime()
    ))
    
    const overlapEnd = new Date(Math.min(
      shiftEndDateTime.getTime(),
      zoneEnd.getTime(),
      nightEnd.getTime()
    ))

    if (overlapStart < overlapEnd) {
      return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60)
    }
    return 0
  }

  totalNightInZone += calculateTripleOverlap(nightStartYesterday, nightEndYesterday)
  totalNightInZone += calculateTripleOverlap(nightStartToday, nightEndToday)

  return totalNightInZone
}

/**
 * Calculate night hours for 20:00-06:00 period (35.5h qualification)
 */
export function calculateNightHours20to6(startTime: string, endTime: string): number {
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

  // Period 1: 20:00 to midnight
  const period1Start = Math.max(startMinutes, nightStart)
  const period1End = Math.min(endMinutes, midnight)
  if (period1Start < period1End) {
    nightHours += (period1End - period1Start) / 60
  }

  // Period 2: midnight to 06:00
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
 * Build detailed message for three-split check results
 */
export function buildThreeSplitDetails(params: {
  planTypeDesc: string
  qualifiesFor33_6: boolean
  qualifiesFor35_5: boolean
  meetsNightHours35: boolean
  avgNightHoursPerWeek20to6: number
  requiredNightHours: number
  meetsSundayRequirement: boolean
  sundaysWorked: number
  totalSundays: number
  sundayWorkRatio: number
  has24HourCoverage: boolean
  meetsNonNightRequirement: boolean
  nonNightPercent: number
  requiredNonNightPercent: number
  totalHours: number
  totalNightHoursTariff: number
  nightHoursLabel: string
  totalHolidayHoursWorked: number
  reductionFromNight: number
  reductionFromHoliday: number
  reductionFromNightTotal: number
  reductionFromHolidayTotal: number
  reductionFromHolidayPostPercent: number
  computedReduction: number
  appliedReduction: number
  baseStandardWeek: number
  computedWeeklyAfterReduction: number
  expectedMaxHours: number
  actualAvgHoursPerWeek: number
  exceedsHourLimit: boolean
  totalZonesChecked: number
  totalRedDaysWorked: number
  totalHolidayZones: number
  planDurationWeeks: number
  planWorkPercent: number
  hoursToSubtractFromFShifts: number
  hoursToSubtractFromFShiftsNight: number
  hoursToSubtractFromVacation: number
  hoursToSubtractFromVacationNight: number
  nightHoursInHolidayZones: number
  rawHolidayHoursBeforeAdjustment: number
  rawNightHoursBeforeAdjustment: number
  f3Days: number
  f4Days: number
  f5Days: number
  vacationDays: number
  overlayDays: Array<{ type: string; week: number; day: number; date: string; underlyingShift: string; hours: number }>
}): string[] {
  const p = params

  const header = [
    `Plan type: ${p.planTypeDesc}`,
    '',
    '✅ FIXED VERSION: Zones are merged FIRST, then adjusted for night boundaries',
    '   Order: Create zones → Merge overlaps → Adjust for night start → Calculate',
    '',
    '=== QUALIFICATION SUMMARY ===',
    p.qualifiesFor33_6 ? '✅ Qualifies for 33.6h work week' : '✗ Does NOT qualify for 33.6h work week',
    p.qualifiesFor35_5 ? '✅ Qualifies for 35.5h work week' : '✗ Does NOT qualify for 35.5h work week',
    ''
  ]

  const qualificationLogic = [
    '=== WHY (decision logic) ===',
    '33.6h requires: (1) 24-hour coverage AND (2) Sunday frequency AND (3) ≥ required non-night %',
    `  24-hour coverage: ${p.has24HourCoverage ? '✓' : '✗'}`,
    `  Sunday requirement: ${p.meetsSundayRequirement ? '✓' : '✗'} (${p.sundaysWorked}/${p.totalSundays} Sundays worked; ratio ≈ ${isFinite(p.sundayWorkRatio) ? ('1 in ' + (p.sundayWorkRatio).toFixed(2)) : 'never worked'})`,
    `  Non-night requirement: ${p.meetsNonNightRequirement ? '✓' : '✗'} (${p.nonNightPercent.toFixed(1)}% non-night, required: ≥ ${p.requiredNonNightPercent}%)`,
    '',
    '35.5h requires ONE of:',
    `  (A) night hours (20:00–06:00) ≥ required → ${p.avgNightHoursPerWeek20to6.toFixed(2)}h/week (required: ≥${p.requiredNightHours}h) → ${p.meetsNightHours35 ? '✓' : '✗'}`,
    `  (B) Sunday frequency → ${p.meetsSundayRequirement ? '✓' : '✗'}`,
    ''
  ]

  const rawNightHours = p.rawNightHoursBeforeAdjustment
  const adjustedNightHours = rawNightHours - p.hoursToSubtractFromFShiftsNight - p.hoursToSubtractFromVacationNight
  const nightCredit = adjustedNightHours * 0.25
  const nightCreditPerWeek = nightCredit / p.planDurationWeeks

  const rawHolidayHours = p.rawHolidayHoursBeforeAdjustment
  const adjustedHolidayHours = rawHolidayHours - p.hoursToSubtractFromFShifts - p.hoursToSubtractFromVacation - p.nightHoursInHolidayZones
  const holidayCredit = adjustedHolidayHours * (10 / 60)
  const holidayCreditPerWeek = holidayCredit / p.planDurationWeeks
  const holidayCreditScaled = holidayCreditPerWeek * (p.planWorkPercent / 100)

  const reductionSummary = [
    '=== REDUCTION CALCULATION (33.6 path) ===',
    '',
    '--- Reference Bounds ---',
    `Reference 33.6h work week`,
    `Reference 35.5h work week`,
    `Your work percent: ${p.planWorkPercent}%`,
    `Lower bound (33.6h × ${p.planWorkPercent}%): ${(33.6 * (p.planWorkPercent/100)).toFixed(2)} h/week`,
    `Upper bound (35.5h × ${p.planWorkPercent}%): ${(35.5 * (p.planWorkPercent/100)).toFixed(2)} h/week`,
    '',
    '--- Night Hours Credit ---',
    `Night hours (raw): ${rawNightHours.toFixed(2)} h`,
    ...(p.hoursToSubtractFromFShiftsNight > 0 ? [
      `  - F3/F4/F5 night hours: -${p.hoursToSubtractFromFShiftsNight.toFixed(2)} h`,
    ] : []),
    ...(p.hoursToSubtractFromVacationNight > 0 ? [
      `  - Vacation night hours: -${p.hoursToSubtractFromVacationNight.toFixed(2)} h`,
    ] : []),
    `Night hours (adjusted): ${adjustedNightHours.toFixed(2)} h`,
    `Converted to credit (15 min per hour = 0.25h credit per hour): ${nightCredit.toFixed(2)} h total`,
    `Night credit per week: ${nightCreditPerWeek.toFixed(2)} h/week`,
    '',
    '--- Holiday/Sunday Hours Credit ---',
    `Holiday/Sunday hours (raw): ${rawHolidayHours.toFixed(2)} h`,
    ...(p.hoursToSubtractFromFShifts > 0 ? [
      `  - F3/F4/F5 hours in zones: -${p.hoursToSubtractFromFShifts.toFixed(2)} h`,
    ] : []),
    ...(p.hoursToSubtractFromVacation > 0 ? [
      `  - Vacation hours in zones: -${p.hoursToSubtractFromVacation.toFixed(2)} h`,
    ] : []),
    ...(p.nightHoursInHolidayZones > 0 ? [
      `  - Night hours in zones (avoid double-count): -${p.nightHoursInHolidayZones.toFixed(2)} h`,
    ] : []),
    `Holiday/Sunday hours (adjusted): ${adjustedHolidayHours.toFixed(2)} h`,
    `Converted to credit (10 min per hour = ${(10/60).toFixed(3)}h credit per hour): ${holidayCredit.toFixed(2)} h total`,
    `Holiday credit per week (before work % scaling): ${holidayCreditPerWeek.toFixed(2)} h/week`,
    `Holiday credit per week (scaled by ${p.planWorkPercent}%): ${holidayCreditScaled.toFixed(2)} h/week`,
    '',
    '--- Final Calculation ---',
    `Base (standard) week: ${p.baseStandardWeek.toFixed(2)} h/week`,
    `Total reduction (night + holiday credits): ${p.appliedReduction.toFixed(2)} h/week`,
    `Candidate weekly hours: ${p.baseStandardWeek.toFixed(2)} - ${p.appliedReduction.toFixed(2)} = ${p.computedWeeklyAfterReduction.toFixed(2)} h/week`,
    ...(p.computedWeeklyAfterReduction > (35.5 * (p.planWorkPercent/100)) ? [
      `  ↳ Above upper bound, capped to ${(35.5 * (p.planWorkPercent/100)).toFixed(2)} h/week`,
    ] : p.computedWeeklyAfterReduction < (33.6 * (p.planWorkPercent/100)) ? [
      `  ↳ Below lower bound, capped to ${(33.6 * (p.planWorkPercent/100)).toFixed(2)} h/week`,
    ] : [
      `  ↳ Within bounds, using computed value`,
    ]),
    `Final allowed weekly hours (after bounds check): ${p.expectedMaxHours.toFixed(2)} h/week`,
    ''
  ]

  if (p.overlayDays.length > 0) {
    reductionSummary.push('--- F3/F4/F5 Overlay Details ---')
    const f3List = p.overlayDays.filter(d => d.type === 'F3')
    const f4List = p.overlayDays.filter(d => d.type === 'F4')
    const f5List = p.overlayDays.filter(d => d.type === 'F5')
    const vacationList = p.overlayDays.filter(d => d.type === 'FE')

    if (f3List.length > 0) {
      reductionSummary.push(`F3 (Helgedags fri) - ${f3List.length} days:`)
      f3List.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        reductionSummary.push(`  Week ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}h`)
      })
    }
    if (f4List.length > 0) {
      reductionSummary.push(`F4 (Feriedagar) - ${f4List.length} days:`)
      f4List.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        reductionSummary.push(`  Week ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}h`)
      })
    }
    if (f5List.length > 0) {
      reductionSummary.push(`F5 (Erstatningsfridagar) - ${f5List.length} days:`)
      f5List.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        reductionSummary.push(`  Week ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}h`)
      })
    }
    if (vacationList.length > 0) {
      reductionSummary.push(`FE (Feriedagar) - ${vacationList.length} days:`)
      vacationList.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        reductionSummary.push(`  Week ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}h`)
      })
    }
    reductionSummary.push('')
  }

  const hoursSummary = [
    '=== HOURS / METRICS (raw numbers used) ===',
    `Total hours (sum of NON-DEFAULT shifts across rotations): ${p.totalHours.toFixed(2)} h`,
    `Total tariff night hours (${p.nightHoursLabel}): ${p.totalNightHoursTariff.toFixed(2)} h`,
    `Non-night %: ${p.nonNightPercent.toFixed(1)}%`,
    `Avg night hours (20:00–06:00) used for 35.5h-check: ${p.avgNightHoursPerWeek20to6.toFixed(2)} h/week`,
    `Average actual hours per week: ${p.actualAvgHoursPerWeek.toFixed(2)} h/week`,
    `Allowed (final) weekly hours: ${p.expectedMaxHours.toFixed(2)} h/week`,
    `Exceeds allowed limit: ${p.exceedsHourLimit ? 'YES' : 'NO'}`,
    ''
  ]

  const zoneSummary = [
    '=== TIME ZONE / HOLIDAY CHECKS ===',
    `Total zones checked (Sundays + relevant holidays): ${p.totalZonesChecked}`,
    `Sundays worked: ${p.sundaysWorked}/${p.totalSundays}`,
    `Red days worked (non-Sunday holidays): ${p.totalRedDaysWorked}/${p.totalHolidayZones}`,
    `Holiday/Sunday hours worked (after adjustments, NO night overlap): ${p.totalHolidayHoursWorked.toFixed(2)} h`,
    ''
  ]

  const recommendation = [
    '=== RECOMMENDATION / NEXT ACTIONS ==='
  ]

  if (p.exceedsHourLimit) {
    recommendation.push(
      `Plan exceeds the allowed weekly hours for the qualification. Reduce by ${(p.actualAvgHoursPerWeek - p.expectedMaxHours).toFixed(2)} h/week.`
    )
  } else if (!p.qualifiesFor33_6 && !p.qualifiesFor35_5) {
    const guidance: string[] = []
    guidance.push(' • Does not qualify for reduced week. Consider increasing night hours or Sunday/holiday coverage, or restructure to achieve 24h coverage and non-night % for 33.6 path.')
    recommendation.push(...guidance)
  } else {
    recommendation.push('No corrective action required; the plan qualifies and is within the allowed weekly hours.')
  }

  return [
    ...header,
    ...qualificationLogic,
    ...reductionSummary,
    ...hoursSummary,
    ...zoneSummary,
    ...recommendation
  ]
}