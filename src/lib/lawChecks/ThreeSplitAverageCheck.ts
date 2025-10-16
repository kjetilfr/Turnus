// src/lib/lawChecks/ThreeSplitAverageCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { getNightHoursCalculator, getNightHoursLabel } from '@/lib/utils/shiftTimePeriods'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'


/**
 * Three-Split Average Check (Simplified)
 * 
 * Qualifications:
 * 
 * For 35.5h work week, must meet ONE of:
 * 1. Average at least 1.39 hours of night work per week (20:00-06:00)
 * 2. Work every 3rd Sunday on average
 * 
 * For 33.6h work week, must meet ALL of:
 * 1. Work on all hours of the day (24-hour coverage)
 * 2. Work every 3rd Sunday on average
 * 3. At least 25% of hours are non-night hours (night = tariffavtale-specific)
 */

export const threeSplitAverageCheck: LawCheck = {
  id: 'three-split-average',
  name: 'Three-Split Average Qualification',
  description: 'Verifies qualification for reduced work weeks: 35.5h week (night hours OR Sunday work) or 33.6h week (24-hour coverage AND Sunday work AND 25% non-night hours).',
  category: 'shared',
  lawType: 'hta',
  lawReferences: [
    {
      title: 'HTA § 4.2.2, 4.2.3 og 4.2.4 - Arbeidstid',
      url: 'https://www.ks.no/globalassets/fagomrader/lonn-og-tariff/tariff-2024/Hovedtariffavtalen-2024-2026-interactive-120924.pdf'
    },
    {
      title: 'Ny tariffbestemmelse om ukentlig arbeidstid for tredelt skift- og turnusarbeid med virkning fra 01.01.2011',
      url: 'https://www.ks.no/contentassets/8f9b17499f234bb8b556c546272be4cc/tredelt-skift-og-turnus-b12_2010.pdf'
    }
  ],
  applicableTo: ['main', 'helping', 'year'],
  inputs: [
    {
      id: 'requiredNightHoursPerWeek',
      label: '35.5h: Required Average Night Hours per Week (20:00-06:00)',
      type: 'number',
      defaultValue: 1.39,
      min: 0,
      max: 24,
      step: 0.01,
      unit: 'hours/week'
    },
    {
      id: 'requiredSundayFrequency',
      label: 'Required Sunday Work Frequency (1 in X Sundays)',
      type: 'number',
      defaultValue: 3,
      min: 1,
      max: 10,
      step: 1,
      unit: 'Sundays'
    },
    {
      id: 'requiredNonNightPercent',
      label: '33.6h: Required Non-Night Hours Percentage',
      type: 'number',
      defaultValue: 25,
      min: 0,
      max: 100,
      step: 1,
      unit: '%'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const requiredNightHours = (inputs.requiredNightHoursPerWeek as number) || 1.39
    const requiredSundayFreq = (inputs.requiredSundayFrequency as number) || 3
    const requiredNonNightPercent = (inputs.requiredNonNightPercent as number) || 25
    const effectiveRotations: Rotation[] = rotations
    const effectiveShifts: Shift[] = shifts

    console.log()
    console.log(effectiveRotations + " " + effectiveShifts)
    
    const result: LawCheckResult = {
      status: 'fail',
      message: '',
      details: [],
      violations: []
    }
    console.log('🔍 Running Three-Split Average Check for plan:', plan.name, plan.id)
    console.log('Plan type:', plan.type, 'Duration weeks:', plan.duration_weeks)
    console.log('Inputs:', { requiredNightHours, requiredSundayFreq, requiredNonNightPercent })

    // Determine which rotations and shifts to use



    // Get plan dates
    const planStartDate = new Date(plan.date_started)
    const planEndDate = new Date(planStartDate)
    planEndDate.setDate(planEndDate.getDate() + plan.duration_weeks * 7)

    // ============================================================
    // Create all time zones (Sundays + holidays for non-main plans)
    // ============================================================
    const allTimeZones: HolidayTimeZone[] = []
    
    // Always add Sunday zones
    allTimeZones.push(...createSundayTimeZones(planStartDate, planEndDate))
    
    // Add holiday zones for helping and non-rotation-based year plans
    if (plan.type === 'helping' || (plan.type === 'year' && plan.year_plan_mode !== 'rotation_based')) {
      const startYear = planStartDate.getFullYear()
      const endYear = planEndDate.getFullYear()
      
      for (let year = startYear; year <= endYear; year++) {
        allTimeZones.push(...getHolidayTimeZones(year))
      }
    }
    
    // Filter to relevant time zones and sort
    const relevantTimeZones = allTimeZones.filter(zone =>
      zone.startDateTime < planEndDate && zone.endDateTime > planStartDate
    )
    relevantTimeZones.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

    // ============================================================
    // Calculate work in time zones
    // ============================================================
    const zonesWorked: Array<{
      zone: HolidayTimeZone
      overlapHours: number
      isWorked: boolean
    }> = []

    relevantTimeZones.forEach(zone => {
      let totalOverlapHours = 0
      
      effectiveRotations.forEach(rotation => {
        if (!rotation.shift_id) return
        const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
        
        const overlapHours = calculateTimeZoneOverlap(rotation, shift, zone, planStartDate)
        if (overlapHours > 0) {
          totalOverlapHours += overlapHours
        }
      })
      
      zonesWorked.push({ 
        zone, 
        overlapHours: totalOverlapHours, 
        isWorked: totalOverlapHours > 0 
      })
    })

    // ============================================================
    // RED DAY + SUNDAY OVERLAP LOGGING
    // ============================================================
    console.log('\n🟥 RED DAY / SUNDAY ZONES')
    zonesWorked.forEach(zw => {
      const zoneDate = zw.zone.startDateTime.toISOString().split('T')[0]
      if (zw.isWorked && zw.overlapHours > 0) {
        console.log(
          `  ${zoneDate} | ${zw.zone.holidayName.padEnd(10)} | ${zw.overlapHours.toFixed(2)}h worked`
        )
      }
    })

    // ============================================================
    // Calculate metrics for qualifications
    // ============================================================

// ============================================================
// NIGHT HOURS CALCULATION + DEBUG LOG
// ============================================================

console.log('\n🌙 NIGHT HOURS CALCULATION (20:00–06:00 for 35.5h check)')
let totalNightHours20to6 = 0

effectiveRotations.forEach((rotation: Rotation) => {
  if (!rotation.shift_id) return
  const shift = effectiveShifts.find((s: Shift) => s.id === rotation.shift_id)
  if (!shift || !shift.start_time || !shift.end_time) return

  const nightHours = calculateNightHours20to6(shift.start_time, shift.end_time)
  if (nightHours > 0) {
    console.log(
      `  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week}: ${shift.start_time}-${shift.end_time} → ${nightHours.toFixed(2)}h night (20–06)`
    )
  }
  totalNightHours20to6 += nightHours
})

const avgNightHoursPerWeek20to6 = totalNightHours20to6 / plan.duration_weeks
console.log(`  → Average per week: ${avgNightHoursPerWeek20to6.toFixed(2)}h`)




    // 2. Sunday work frequency
    const sundayZones = zonesWorked.filter(zw => 
      zw.zone.holidayName === 'Sunday' || zw.zone.localName === 'Søndag'
    )
    const totalSundays = sundayZones.length
    const sundaysWorked = sundayZones.filter(z => z.isWorked).length
    const sundayWorkRatio = totalSundays > 0 && sundaysWorked > 0 ? totalSundays / sundaysWorked : 0
    const meetsSundayRequirement = sundayWorkRatio > 0 && sundayWorkRatio <= requiredSundayFreq

    // 3. 24-hour coverage check
    const has24HourCoverage = check24HourCoverage(effectiveRotations, effectiveShifts)

    // 4. Calculate non-night hours percentage
// ============================================================
// TARIFF-BASED NIGHT HOURS (used for 33.6h qualification)
// ============================================================
console.log(`\n🌙 TARIFF NIGHT HOURS (${plan.tariffavtale.toUpperCase()} – ${getNightHoursLabel(plan.tariffavtale)})`)
const calculateNightHours = getNightHoursCalculator(plan.tariffavtale)
const nightHoursLabel = getNightHoursLabel(plan.tariffavtale)

let totalHours = 0
let totalNightHoursTariff = 0

effectiveRotations.forEach(rotation => {
  if (!rotation.shift_id) return
  const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
  if (!shift || !shift.start_time || !shift.end_time) return

  const shiftHours = calculateShiftHours(shift.start_time, shift.end_time)
  const tariffNight = calculateNightHours(shift.start_time, shift.end_time)
  totalHours += shiftHours
  totalNightHoursTariff += tariffNight

  if (tariffNight > 0) {
    console.log(
      `  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week}: ${shift.start_time}-${shift.end_time} → ${tariffNight.toFixed(2)}h night (${nightHoursLabel})`
    )
  }
})

console.log(`  → Total tariff night hours: ${totalNightHoursTariff.toFixed(2)}h`)
    
    const nonNightHours = totalHours - totalNightHoursTariff
    const nonNightPercent = totalHours > 0 ? (nonNightHours / totalHours) * 100 : 0
    const meetsNonNightRequirement = nonNightPercent >= requiredNonNightPercent

    // After non-night calculation:
    console.log('\n🕒 Hours Summary:')
    console.log(`  Total hours: ${totalHours.toFixed(2)}h`)
    console.log(`  Total night hours (${nightHoursLabel}): ${totalNightHoursTariff.toFixed(2)}h`)
    console.log(`  Non-night %: ${nonNightPercent.toFixed(1)}%`)

    // Before qualification logic:
    console.log('\n📊 Qualification Metrics:')
    console.log(`  Avg night hours (20–06): ${avgNightHoursPerWeek20to6.toFixed(2)}h/week`)
    console.log(`  Sunday work ratio: 1 in ${sundayWorkRatio.toFixed(2)} Sundays`)
    console.log(`  Has 24-hour coverage: ${has24HourCoverage}`)
    console.log(`  Non-night %: ${nonNightPercent.toFixed(1)}% (Req ≥ ${requiredNonNightPercent}%)`)

    // ============================================================
    // Check qualifications
    // ============================================================
    const meetsNightHours35 = avgNightHoursPerWeek20to6 >= requiredNightHours
    const qualifiesFor35_5 = meetsNightHours35 || meetsSundayRequirement
    const qualifiesFor33_6 = has24HourCoverage && meetsSundayRequirement && meetsNonNightRequirement

    // Calculate actual average hours per week
    const actualAvgHoursPerWeek = totalHours / plan.duration_weeks
    
    // Check if actual hours exceed qualified work week
    let exceedsHourLimit = false
    let expectedMaxHours = 0
    let hourLimitMessage = ''
    
    if (qualifiesFor33_6) {
      expectedMaxHours = 33.6 * (plan.work_percent / 100)
      exceedsHourLimit = actualAvgHoursPerWeek > expectedMaxHours
      if (exceedsHourLimit) {
        hourLimitMessage = `Actual hours (${actualAvgHoursPerWeek.toFixed(2)}h/week) exceed 33.6h work week limit (${expectedMaxHours.toFixed(2)}h for ${plan.work_percent}%)`
      }
    } else if (qualifiesFor35_5) {
      expectedMaxHours = 35.5 * (plan.work_percent / 100)
      exceedsHourLimit = actualAvgHoursPerWeek > expectedMaxHours
      if (exceedsHourLimit) {
        hourLimitMessage = `Actual hours (${actualAvgHoursPerWeek.toFixed(2)}h/week) exceed 35.5h work week limit (${expectedMaxHours.toFixed(2)}h for ${plan.work_percent}%)`
      }
    }

    // Before result build:
    console.log('\n✅ Qualification Results:')
    console.log(`  Qualifies for 35.5h: ${qualifiesFor35_5}`)
    console.log(`  Qualifies for 33.6h: ${qualifiesFor33_6}`)
    console.log(`  Avg weekly hours: ${actualAvgHoursPerWeek.toFixed(2)}h/week`)
    console.log(`  Expected max hours: ${expectedMaxHours.toFixed(2)}h/week`)
    console.log(`  Exceeds hour limit: ${exceedsHourLimit}`)


    console.log('\n📊 FINAL QUALIFICATION SUMMARY')
console.log({
  qualifiesFor35_5,
  qualifiesFor33_6,
  avgNightHoursPerWeek20to6,
  sundayWorkRatio,
  has24HourCoverage,
  nonNightPercent,
  actualAvgHoursPerWeek,
  expectedMaxHours,
  exceedsHourLimit,
})



    // ============================================================
    // Build result
    // ============================================================
    const planTypeDesc = plan.type === 'helping' ? 'Helping plan' : 
                        plan.type === 'year' && plan.year_plan_mode !== 'rotation_based' ? 'Year plan (non-rotation)' :
                        'Main plan'
    
    const totalRedDaysWorked = zonesWorked.filter(z => z.isWorked && z.zone.holidayName !== 'Sunday').length
    const totalHolidayZones = zonesWorked.filter(z => z.zone.holidayName !== 'Sunday').length

    if ((qualifiesFor33_6 || qualifiesFor35_5) && !exceedsHourLimit) {
      result.status = 'pass'
      
      if (qualifiesFor33_6) {
        result.message = `✅ Qualifies for 33.6h work week (${actualAvgHoursPerWeek.toFixed(2)}h/week current)`
      } else {
        result.message = `✅ Qualifies for 35.5h work week (${actualAvgHoursPerWeek.toFixed(2)}h/week current)`
      }
      
      result.details = [
        `Plan type: ${planTypeDesc}`,
        '',
        '📊 Qualification Analysis:',
        '',
        '35.5h work week requirements (need ONE):',
        `  ${meetsNightHours35 ? '✓' : '✗'} Night hours (20:00-06:00): ${avgNightHoursPerWeek20to6.toFixed(2)}h/week (required: ≥${requiredNightHours}h)`,
        `  ${meetsSundayRequirement ? '✓' : '✗'} Sunday work: ${sundaysWorked}/${totalSundays} (1 in ${sundayWorkRatio.toFixed(1)}, required: ≤1 in ${requiredSundayFreq})`,
        '',
        '33.6h work week requirements (need ALL):',
        `  ${has24HourCoverage ? '✓' : '✗'} 24-hour coverage`,
        `  ${meetsSundayRequirement ? '✓' : '✗'} Sunday work: Already checked above`,
        `  ${meetsNonNightRequirement ? '✓' : '✗'} Non-night hours: ${nonNightPercent.toFixed(1)}% (required: ≥${requiredNonNightPercent}%)`,
        '',
        '📅 Time Zone Work Summary:',
        `  Sundays worked: ${sundaysWorked}/${totalSundays}`,
      ]
      
      if (totalHolidayZones > 0) {
        result.details.push(`  Red days worked: ${totalRedDaysWorked}/${totalHolidayZones}`)
      }
      
      result.details.push(
        `  Total zones checked: ${relevantTimeZones.length}`,
        '',
        '⏱️ Hours Summary:',
        `  Total hours: ${totalHours.toFixed(2)}h`,
        `  Night hours ${nightHoursLabel}: ${totalNightHoursTariff.toFixed(2)}h`,
        `  Average per week: ${actualAvgHoursPerWeek.toFixed(2)}h`,
        `  Qualified limit: ${expectedMaxHours.toFixed(2)}h/week`
      )
    } else if (exceedsHourLimit) {
      result.status = 'fail'
      result.message = qualifiesFor33_6 
        ? `✓ Qualifies for 33.6h BUT ✗ exceeds hour limit (${actualAvgHoursPerWeek.toFixed(2)}h > ${expectedMaxHours.toFixed(2)}h)`
        : `✓ Qualifies for 35.5h BUT ✗ exceeds hour limit (${actualAvgHoursPerWeek.toFixed(2)}h > ${expectedMaxHours.toFixed(2)}h)`
      
      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: hourLimitMessage
      }]
      
      result.details = [
        `Plan type: ${planTypeDesc}`,
        '',
        'Requirements met but hours exceed limit!',
        `Current: ${actualAvgHoursPerWeek.toFixed(2)}h/week`,
        `Maximum: ${expectedMaxHours.toFixed(2)}h/week`,
        `Reduce by: ${(actualAvgHoursPerWeek - expectedMaxHours).toFixed(2)}h/week`
      ]
    } else {
      result.status = 'fail'
      result.message = `✗ Does NOT qualify for reduced work week`
      
      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: 'Does not meet requirements for either 35.5h or 33.6h work week'
      }]
      
      result.details = [
        `Plan type: ${planTypeDesc}`,
        '',
        '📊 Failed Requirements:',
        '',
        '35.5h work week (need ONE):',
        `  ${meetsNightHours35 ? '✓' : '✗'} Night hours: ${avgNightHoursPerWeek20to6.toFixed(2)}/${requiredNightHours}h per week`,
        `  ${meetsSundayRequirement ? '✓' : '✗'} Sunday work: ${sundaysWorked}/${totalSundays} Sundays`,
        '',
        '33.6h work week (need ALL):',
        `  ${has24HourCoverage ? '✓' : '✗'} 24-hour coverage`,
        `  ${meetsSundayRequirement ? '✓' : '✗'} Sunday work frequency`,
        `  ${meetsNonNightRequirement ? '✓' : '✗'} Non-night hours: ${nonNightPercent.toFixed(1)}%/${requiredNonNightPercent}%`,
        '',
        `Standard work week applies: ${(37.5 * plan.work_percent / 100).toFixed(2)}h/week`
      ]
    }

    return result
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Create Sunday time zones (Saturday 18:00 - Sunday 22:00)
 */
function createSundayTimeZones(startDate: Date, endDate: Date): HolidayTimeZone[] {
  const zones: HolidayTimeZone[] = []
  const current = new Date(startDate)
  
  // Move to first Sunday on/after startDate
  while (current.getDay() !== 0) {
    current.setDate(current.getDate() + 1)
  }
  
  while (current <= endDate) {
    const sunday = new Date(current)
    const saturday = new Date(current)
    saturday.setDate(saturday.getDate() - 1)
    
    const zoneStart = new Date(saturday)
    zoneStart.setHours(18, 0, 0, 0)
    
    const zoneEnd = new Date(sunday)
    zoneEnd.setHours(22, 0, 0, 0)
    
    if (zoneEnd >= startDate && zoneStart <= endDate) {
      zones.push({
        holidayName: 'Sunday',
        localName: 'Søndag',
        startDateTime: zoneStart,
        endDateTime: zoneEnd,
        type: 'standard'
      })
    }
    
    current.setDate(current.getDate() + 7)
  }
  
  return zones
}

/**
 * Calculate overlap between a rotation/shift and a time zone
 */
function calculateTimeZoneOverlap(
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
    // Sunday night shift - starts Saturday
    const saturday = new Date(rotationDate)
    saturday.setDate(saturday.getDate() - 1)
    
    shiftStartDateTime = new Date(saturday)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)
    
    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else if (isNightShift) {
    // Regular night shift
    const prevDay = new Date(rotationDate)
    prevDay.setDate(prevDay.getDate() - 1)
    
    shiftStartDateTime = new Date(prevDay)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)
    
    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else {
    // Day shift
    shiftStartDateTime = new Date(rotationDate)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)
    
    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  }
  
  // Calculate overlap
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
 * Get rotation date
 */
function getRotationDate(planStartDate: Date, weekIndex: number, dayOfWeek: number): Date {
  const d = new Date(planStartDate)
  const jsDay = d.getDay()
  const mondayFirstIndex = (jsDay + 6) % 7
  d.setDate(d.getDate() - mondayFirstIndex)
  d.setDate(d.getDate() + (weekIndex * 7) + dayOfWeek)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Calculate night hours for 20:00-06:00 period (35.5h qualification)
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
 * Check 24-hour coverage
 */
function check24HourCoverage(rotations: Rotation[], shifts: Shift[]): boolean {
  const timeRanges: Array<{ start: number; end: number }> = []
  
  rotations.forEach((rotation: Rotation) => {
    if (rotation.shift_id) {
      const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
      if (shift && shift.start_time && shift.end_time) {
        const parseTime = (time: string) => {
          const [h, m] = time.split(':').map(Number)
          return h * 60 + m
        }
        
        const startMinutes = parseTime(shift.start_time)
        const endMinutes = parseTime(shift.end_time)
        
        if (endMinutes < startMinutes) {
          // Night shift - split into two ranges
          timeRanges.push({ start: startMinutes, end: 24 * 60 })
          timeRanges.push({ start: 0, end: endMinutes })
        } else {
          timeRanges.push({ start: startMinutes, end: endMinutes })
        }
      }
    }
  })
  
  if (timeRanges.length === 0) return false
  
  // Sort and merge overlapping ranges
  timeRanges.sort((a, b) => a.start - b.start)
  const mergedRanges: Array<{ start: number; end: number }> = [timeRanges[0]]
  
  for (let i = 1; i < timeRanges.length; i++) {
    const current = timeRanges[i]
    const last = mergedRanges[mergedRanges.length - 1]
    
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      return false // Gap found
    }
  }
  
  return mergedRanges.length === 1 && 
         mergedRanges[0].start === 0 && 
         mergedRanges[0].end === 24 * 60
}