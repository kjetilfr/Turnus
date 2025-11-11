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
 * Create combined Sunday time zones for COUNTING if Sundays were worked.
 * Each weekend is ONE zone: Saturday 18:00 → Sunday 24:00 (or end of Sunday)
 * This is different from the split zones used for calculations.
 */
export function createCombinedSundayZones(
  startDate: Date, 
  endDate: Date, 
  tariffavtale: string
): HolidayTimeZone[] {
  const zones: HolidayTimeZone[] = []
  const current = new Date(startDate)

  console.log(`📅 Creating COMBINED Sunday zones for counting (Saturday 18:00 - Sunday end)`)

  // Move to first Sunday on/after startDate
  while (current.getDay() !== 0) {
    current.setDate(current.getDate() + 1)
  }

  while (current <= endDate) {
    const sunday = new Date(current)
    const saturday = new Date(current)
    saturday.setDate(saturday.getDate() - 1)

    // COMBINED ZONE: Saturday 18:00 → Sunday 24:00
    const zoneStart = new Date(saturday)
    zoneStart.setHours(18, 0, 0, 0)
    
    const zoneEnd = new Date(sunday)
    zoneEnd.setHours(23, 59, 59, 999) // End of Sunday

    if (zoneEnd >= startDate && zoneStart <= endDate) {
      zones.push({
        holidayName: 'Sunday',
        localName: 'Helg (Lørdag 18:00 - Søndag)',
        startDateTime: zoneStart,
        endDateTime: zoneEnd,
        type: 'standard'
      })
      
      console.log(`   Created combined zone: ${formatDateLocal(zoneStart)} 18:00 - ${formatDateLocal(zoneEnd)} 23:59`)
    }

    current.setDate(current.getDate() + 7)
  }

  console.log(`   Total combined Sunday zones created: ${zones.length}`)
  return zones
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
  effectiveWeeks: number
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
    '=== KVALIFISERINGSOPPSUMMERING ===',
    p.qualifiesFor33_6 ? '✅ Kvalifiserer for 3-delt snitt' : '✗ Kvalifiserer IKKJE for 3-delt snitt',
    p.qualifiesFor35_5 ? `✅ Kvalifiserer for 35,5t arbeidsveke (${35.5 * p.planWorkPercent / 100})` : `✗ Kvalifiserer IKKJE for 35,5t arbeidsveke (${35.5 * p.planWorkPercent / 100})`,
    ''
  ]

  const qualificationLogic = [
    '=== KVIFOR (avgjeringlogikk) ===',
    '3-delt snnitt krev: (1) 24-timars dekning OG (2) søndagsfrekvens OG (3) ≥ kravd ikkje-natt %',
    `  24-timars dekning: ${p.has24HourCoverage ? '✓' : '✗'}`,
    `  Søndagskrav: ${p.meetsSundayRequirement ? '✓' : '✗'} (${p.sundaysWorked}/${p.totalSundays} søndagar arbeidd; forhold ≈ ${isFinite(p.sundayWorkRatio) ? ('1 av ' + (p.sundayWorkRatio).toFixed(2)) : 'aldri arbeidd'})`,
    `  Ikkje-nattkrav: ${p.meetsNonNightRequirement ? '✓' : '✗'} (${p.nonNightPercent.toFixed(1)}% ikkje-natt, kravd: ≥ ${p.requiredNonNightPercent}%)`,
    '',
    '35,5t krev ÉIN av:',
    `  (A) nattetimar (20:00–06:00) ≥ kravd → ${p.avgNightHoursPerWeek20to6.toFixed(2)}t/veke (kravd: ≥${p.requiredNightHours}t) → ${p.meetsNightHours35 ? '✓' : '✗'}`,
    `  (B) søndagsfrekvens → ${p.meetsSundayRequirement ? '✓' : '✗'}`,
    ''
  ]

  const rawNightHours = p.rawNightHoursBeforeAdjustment
  const adjustedNightHours = rawNightHours - p.hoursToSubtractFromFShiftsNight - p.hoursToSubtractFromVacationNight
  const nightCredit = adjustedNightHours * 0.25
  const nightCreditPerWeek = nightCredit / p.effectiveWeeks

  const rawHolidayHours = p.rawHolidayHoursBeforeAdjustment
  const adjustedHolidayHours = rawHolidayHours - p.hoursToSubtractFromFShifts - p.hoursToSubtractFromVacation
  const holidayCredit = adjustedHolidayHours * (10 / 60)
  const holidayCreditPerWeek = holidayCredit / p.effectiveWeeks
  const holidayCreditScaled = holidayCreditPerWeek * (p.planWorkPercent / 100)

  // Check if there are any subtractions to show
  const hasNightSubtractions = p.hoursToSubtractFromFShiftsNight > 0 || p.hoursToSubtractFromVacationNight > 0
  const hasHolidaySubtractions = p.hoursToSubtractFromFShifts > 0 || p.hoursToSubtractFromVacation > 0

  const reductionSummary = [
    '=== REDUKSJONSBEREKNING (33,6-bane) ===',
    '',
    '--- Referansegrenser ---',
    `Referanse 33,6t arbeidsveke`,
    `Referanse 35,5t arbeidsveke`,
    `Din arbeidsprosent: ${p.planWorkPercent}%`,
    `Nedre grense (33,6t × ${p.planWorkPercent}%): ${(33.6 * (p.planWorkPercent/100)).toFixed(2)}t/veke`,
    `Øvre grense (35,5t × ${p.planWorkPercent}%): ${(35.5 * (p.planWorkPercent/100)).toFixed(2)}t/veke`,
    '',
    '--- Nattetimekreditt ---',
    `Nattetimar (før justeringar): ${rawNightHours.toFixed(2)}t`,
    ...(hasNightSubtractions ? [
      'Frådrag:',
      ...(p.hoursToSubtractFromFShiftsNight > 0 ? [
        `  - F3/F4/F5 nattetimar: -${p.hoursToSubtractFromFShiftsNight.toFixed(2)}t`,
      ] : []),
      ...(p.hoursToSubtractFromVacationNight > 0 ? [
        `  - Ferie (FE) nattetimar: -${p.hoursToSubtractFromVacationNight.toFixed(2)}t`,
      ] : []),
    ] : []),
    `Nattetimar (etter justeringar): ${adjustedNightHours.toFixed(2)}t`,
    `Konvertert til kreditt (15 min per time = 0,25t kreditt per time): ${nightCredit.toFixed(2)}t totalt`,
    `Veker = Veker i turnusplan - (Feriedagar / 7): (${p.planDurationWeeks} - (${((p.planDurationWeeks-p.effectiveWeeks)*7).toFixed(0)}/7)) = ${p.effectiveWeeks.toFixed(2)}`,
    `Nattekreditt per veke (${nightCredit.toFixed(2)}t / ${p.effectiveWeeks.toFixed(2)}): ${nightCreditPerWeek.toFixed(2)}t/veke`,
    '',
    '--- Helg-/Søndagstimekreditt ---',
    `Helg-/søndagstimar (før justeringar): ${rawHolidayHours.toFixed(2)}t`,
    ...(hasHolidaySubtractions ? [
      'Frådrag:',
      ...(p.hoursToSubtractFromFShifts > 0 ? [
        `  - F3/F4/F5 timar i soner: -${p.hoursToSubtractFromFShifts.toFixed(2)}t`,
      ] : []),
      ...(p.hoursToSubtractFromVacation > 0 ? [
        `  - Ferie (FE) timar i soner: -${p.hoursToSubtractFromVacation.toFixed(2)}t`,
      ] : []),
    ] : []),
    `Helg-/søndagstimar (etter justeringar): ${adjustedHolidayHours.toFixed(2)}t`,
    `Konvertert til kreditt (10 min per time = ${(10/60).toFixed(3)}t kreditt per time): ${holidayCredit.toFixed(2)}t totalt`,
    `Veker = Veker i turnusplan - (Feriedagar / 7): (${p.planDurationWeeks} - (${((p.planDurationWeeks-p.effectiveWeeks)*7).toFixed(0)}/7)) = ${p.effectiveWeeks.toFixed(2)}`,
    `Helgekreditt per veke (${holidayCredit.toFixed(2)}t / ${p.effectiveWeeks.toFixed(2)}): ${holidayCreditPerWeek.toFixed(2)}t/veke`,
    `Helgekreditt per veke (skalert med stillingsprosent ${p.planWorkPercent}%): ${holidayCreditScaled.toFixed(2)}t/veke`,
    '',
    '--- Sluttberekning ---',
    `Basis (standard) veke: ${p.baseStandardWeek.toFixed(2)}t/veke`,
    `Total reduksjon (natte- + helgekreditt): ${p.appliedReduction.toFixed(2)}t/veke`,
    `Kandidat veketime: ${p.baseStandardWeek.toFixed(2)} - ${p.appliedReduction.toFixed(2)} = ${p.computedWeeklyAfterReduction.toFixed(2)}t/veke`,
    ...(p.computedWeeklyAfterReduction > (35.5 * (p.planWorkPercent/100)) ? [
      `  ↳ Over øvre grense, tak sett til ${(35.5 * (p.planWorkPercent/100)).toFixed(2)}t/veke`,
    ] : p.computedWeeklyAfterReduction < (33.6 * (p.planWorkPercent/100)) ? [
      `  ↳ Under nedre grense, tak sett til ${(33.6 * (p.planWorkPercent/100)).toFixed(2)}t/veke`,
    ] : [
      `  ↳ Innanfor grenser, brukar berekna verdi`,
    ]),
    `Endeleg tillete veketime (etter grensekontroll): ${p.expectedMaxHours.toFixed(2)}t/veke`,
    ''
  ]

  if (p.overlayDays.length > 0) {
    reductionSummary.push('--- F3/F4/F5/FE Overlagsdetaljar ---')
    const f3List = p.overlayDays.filter(d => d.type === 'F3')
    const f4List = p.overlayDays.filter(d => d.type === 'F4')
    const f5List = p.overlayDays.filter(d => d.type === 'F5')
    const vacationList = p.overlayDays.filter(d => d.type === 'FE')

    if (f3List.length > 0) {
      reductionSummary.push(`F3 (Helgedags fri) - ${f3List.length} dagar:`)
      f3List.forEach(d => {
        const dayNames = ['Mån', 'Tys', 'Ons', 'Tor', 'Fre', 'Lau', 'Søn']
        reductionSummary.push(`  Veke ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}t`)
      })
    }
    if (f4List.length > 0) {
      reductionSummary.push(`F4 (Feriedagar) - ${f4List.length} dagar:`)
      f4List.forEach(d => {
        const dayNames = ['Mån', 'Tys', 'Ons', 'Tor', 'Fre', 'Lau', 'Søn']
        reductionSummary.push(`  Veke ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}t`)
      })
    }
    if (f5List.length > 0) {
      reductionSummary.push(`F5 (Erstatningsfridagar) - ${f5List.length} dagar:`)
      f5List.forEach(d => {
        const dayNames = ['Mån', 'Tys', 'Ons', 'Tor', 'Fre', 'Lau', 'Søn']
        reductionSummary.push(`  Veke ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}t`)
      })
    }
    if (vacationList.length > 0) {
      reductionSummary.push(`FE (Feriedagar) - ${vacationList.length} dagar:`)
      vacationList.forEach(d => {
        const dayNames = ['Mån', 'Tys', 'Ons', 'Tor', 'Fre', 'Lau', 'Søn']
        reductionSummary.push(`  Veke ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}t`)
      })
    }
    reductionSummary.push('')
  }

  return [
    ...header,
    ...qualificationLogic,
    ...reductionSummary
  ]
}