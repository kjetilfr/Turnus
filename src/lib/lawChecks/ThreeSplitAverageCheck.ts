// src/lib/lawChecks/ThreeSplitAverageCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getNightHoursCalculator, getNightHoursLabel } from '@/lib/utils/shiftTimePeriods'

/**
 * Three-Split Average Check
 * 
 * Qualifications:
 * 
 * For 35.5h work week, must meet ONE of:
 * 1. Average at least 1.39 hours of night work per week (20:00 day of - 06:00 next day)
 * 2. Work every 3rd Sunday on average
 * 
 * For 33.6h work week, must meet ALL of:
 * 1. Work on all hours of the day (no time gaps in coverage)
 * 2. Work every 3rd Sunday on average
 * 3. At least 25% of hours are non-night hours (night = 21:00-06:00)
 * 
 * Legal Reference: Related to shift work compensation and scheduling requirements
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
    },
    {
      title: 'Ny tariffbestemmelse om arbeidstid - utfyllende om beregning for deltidsstillinger',
      url: 'https://www.ks.no/contentassets/8f9b17499f234bb8b556c546272be4cc/beregning-for-deltid-b-rundskrivnr-1-2011.pdf'
    },
    {
      title: 'NOU 2008:17 s. 34',
      url: 'https://www.regjeringen.no/contentassets/a992608586e5422a8ed6530e1e0bf6b3/no/pdfs/nou200820080017000dddpdfs.pdf#page=36'
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
    // Get the appropriate night calculator based on tariffavtale
    const calculateNightHours = getNightHoursCalculator(plan.tariffavtale)
    const nightHoursLabel = getNightHoursLabel(plan.tariffavtale)
    
    const requiredNightHours = (inputs.requiredNightHoursPerWeek as number) || 1.39
    const requiredSundayFreq = (inputs.requiredSundayFrequency as number) || 3
    const requiredNonNightPercent = (inputs.requiredNonNightPercent as number) || 25
    
    const result: LawCheckResult = {
      status: 'fail',
      message: '',
      details: [],
      violations: []
    }

    // ============================================================
    // Calculate metrics needed for both qualifications
    // ============================================================

    // 1. Night hours (20:00 to 06:00) for 35.5h qualification
    let totalNightHours20to6 = 0
    
    rotations.forEach((rotation: Rotation) => {
      if (rotation.shift_id) {
        const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const nightHours = calculateNightHours20to6(shift.start_time, shift.end_time)
          totalNightHours20to6 += nightHours
        }
      }
    })

    const avgNightHoursPerWeek20to6 = totalNightHours20to6 / plan.duration_weeks

    // 2. Sunday work for both qualifications
    // Create Sunday zones manually (Saturday 18:00 - Sunday 22:00)
    const sundayZones = createSundayZones(plan.date_started, plan.duration_weeks)

    let sundaysWorked = 0
    const totalSundays = sundayZones.length

    sundayZones.forEach((zone, index) => {
      const weekIndex = Math.floor(index)
      
      const saturdayRotation = rotations.find((r: Rotation) => 
        r.week_index === weekIndex && r.day_of_week === 5 && r.shift_id
      )
      const sundayRotation = rotations.find((r: Rotation) => 
        r.week_index === weekIndex && r.day_of_week === 6 && r.shift_id
      )
      const mondayRotation = rotations.find((r: Rotation) => 
        r.week_index === weekIndex && r.day_of_week === 0 && r.shift_id
      )

      let hasSundayWork = false

      // Check Saturday day shift
      if (saturdayRotation) {
        const shift = shifts.find((s: Shift) => s.id === saturdayRotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const parseTime = (time: string) => {
            const [h, m] = time.split(':').map(Number)
            return h * 60 + m
          }
          const startMinutes = parseTime(shift.start_time)
          const endMinutes = parseTime(shift.end_time)
          const isNightShift = endMinutes < startMinutes

          if (!isNightShift) {
            const overlapHours = calculateSundayZoneOverlap(
              5, shift.start_time, shift.end_time, zone, weekIndex, plan.date_started
            )
            if (overlapHours > 0) {
              hasSundayWork = true
            }
          }
        }
      }

      // Check Sunday shift
      if (!hasSundayWork && sundayRotation) {
        const shift = shifts.find((s: Shift) => s.id === sundayRotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const overlapHours = calculateSundayZoneOverlap(
            6, shift.start_time, shift.end_time, zone, weekIndex, plan.date_started
          )
          if (overlapHours > 0) {
            hasSundayWork = true
          }
        }
      }

      // Check Monday night shift
      if (!hasSundayWork && mondayRotation) {
        const shift = shifts.find((s: Shift) => s.id === mondayRotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const parseTime = (time: string) => {
            const [h, m] = time.split(':').map(Number)
            return h * 60 + m
          }
          const startMinutes = parseTime(shift.start_time)
          const endMinutes = parseTime(shift.end_time)
          const isNightShift = endMinutes < startMinutes

          if (isNightShift) {
            const overlapHours = calculateSundayZoneOverlap(
              0, shift.start_time, shift.end_time, zone, weekIndex, plan.date_started
            )
            if (overlapHours > 0) {
              hasSundayWork = true
            }
          }
        }
      }

      if (hasSundayWork) {
        sundaysWorked++
      }
    })

    const sundayWorkRatio = totalSundays > 0 && sundaysWorked > 0 ? totalSundays / sundaysWorked : 0
    const meetsSundayRequirement = sundayWorkRatio > 0 && sundayWorkRatio <= requiredSundayFreq

    // 3. Additional metrics for 33.6h qualification
    // Check 24-hour coverage
    const has24HourCoverage = check24HourCoverage(rotations, shifts)

    // Calculate non-night hours percentage (night = 21:00-06:00 from TIME_PERIODS.NIGHT_KS)
    let totalHours = 0
    let totalNightHoursTariff = 0 // Night hours using tariffavtale-specific definition
    let totalSundayHours = 0
    let totalOverlapHours = 0

    rotations.forEach((rotation: Rotation) => {
      if (rotation.shift_id) {
        const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const shiftHours = calculateShiftHours(shift.start_time, shift.end_time)
          totalHours += shiftHours
          
          // Calculate night hours using tariffavtale-specific definition
          const nightHours = calculateNightHours(shift.start_time, shift.end_time)
          totalNightHoursTariff += nightHours

          // Calculate Sunday hours for this rotation
          const sundayHours = calculateSundayHoursForRotation(
            rotation,
            shift,
            plan.date_started,
            plan.duration_weeks
          )
          totalSundayHours += sundayHours

          // Calculate overlap (hours that are BOTH night AND Sunday)
          const overlapHours = calculateNightSundayOverlap(
            rotation,
            shift,
            plan.date_started,
            plan.duration_weeks
          )
          totalOverlapHours += overlapHours
        }
      }
    })

    const nonNightHours = totalHours - totalNightHoursTariff
    const nonNightPercent = totalHours > 0 ? (nonNightHours / totalHours) * 100 : 0
    const meetsNonNightRequirement = nonNightPercent >= requiredNonNightPercent

    // Calculate bonus hours for 33.6h work week
    // Night: 15 minutes per hour = 0.25 hours bonus per hour
    // Sunday: 10 minutes per hour = 0.1667 hours bonus per hour
    // Overlap: Only 15 minutes (higher bonus) per hour
    const nightOnlyHours = totalNightHoursTariff - totalOverlapHours
    const sundayOnlyHours = totalSundayHours - totalOverlapHours
    
    const nightBonus = nightOnlyHours * 0.25
    const sundayBonus = sundayOnlyHours * (10 / 60)
    const overlapBonus = totalOverlapHours * 0.25 // Highest bonus
    
    // Total bonus adjusted by work percent for Sunday, plus night bonus
    const sundayBonusAdjusted = sundayBonus * (plan.work_percent / 100)
    const totalBonusHours = sundayBonusAdjusted + nightBonus + overlapBonus
    
    // Average bonus per week
    const avgBonusPerWeek = totalBonusHours / plan.duration_weeks
    
    // Calculate new work week
    const baseWeeklyHours = 37.5 * (plan.work_percent / 100)
    const calculatedWorkWeek = baseWeeklyHours - avgBonusPerWeek
    const minimumWorkWeek = 33.6 * (plan.work_percent / 100) // Scale minimum by work percent
    const finalWorkWeek = Math.max(minimumWorkWeek, calculatedWorkWeek)

    // ============================================================
    // Check qualifications
    // ============================================================

    // 35.5h qualification
    const meetsNightHours35 = avgNightHoursPerWeek20to6 >= requiredNightHours
    const qualifiesFor35_5 = meetsNightHours35 || meetsSundayRequirement

    // 33.6h qualification (must meet ALL requirements)
    const qualifiesFor33_6 = has24HourCoverage && meetsSundayRequirement && meetsNonNightRequirement

    // ============================================================
    // Validate actual hours don't exceed qualified work week
    // ============================================================
    
    // Calculate actual average hours per week from rotations
    const actualAvgHoursPerWeek = totalHours / plan.duration_weeks
    
    let exceedsHourLimit = false
    let expectedMaxHours = 0
    let hourLimitMessage = ''
    
    if (qualifiesFor33_6) {
      // For 33.6h qualification, check against calculated work week
      expectedMaxHours = finalWorkWeek
      exceedsHourLimit = actualAvgHoursPerWeek > expectedMaxHours
      if (exceedsHourLimit) {
        hourLimitMessage = `Actual hours (${actualAvgHoursPerWeek.toFixed(2)}h/week) exceed calculated work week limit (${expectedMaxHours.toFixed(2)}h/week)`
      }
    } else if (qualifiesFor35_5) {
      // For 35.5h qualification, check against 35.5h scaled by work percent
      expectedMaxHours = 35.5 * (plan.work_percent / 100)
      exceedsHourLimit = actualAvgHoursPerWeek > expectedMaxHours
      if (exceedsHourLimit) {
        hourLimitMessage = `Actual hours (${actualAvgHoursPerWeek.toFixed(2)}h/week) exceed 35.5h work week limit (${expectedMaxHours.toFixed(2)}h for ${plan.work_percent}%)`
      }
    }

    // ============================================================
    // Build result
    // ============================================================

    if ((qualifiesFor33_6 || qualifiesFor35_5) && !exceedsHourLimit) {
      result.status = 'pass'
      
      if (qualifiesFor33_6) {
        result.message = `✅ Qualifies for 33.6h work week → Work week: ${finalWorkWeek.toFixed(2)}h/week (currently ${actualAvgHoursPerWeek.toFixed(2)}h/week)`
        result.details = [
          '✅ Qualifies for 33.6h work week:',
          `  ✓ 24-hour coverage: ${has24HourCoverage ? 'YES' : 'NO'}`,
          `  ✓ Sunday work: ${sundaysWorked}/${totalSundays} Sundays (1 in ${sundayWorkRatio.toFixed(1)}, required: 1 in ${requiredSundayFreq})`,
          `  ✓ Non-night hours: ${nonNightPercent.toFixed(1)}% (required: ${requiredNonNightPercent}%)`,
          `  ✓ Actual hours: ${actualAvgHoursPerWeek.toFixed(2)}h/week ≤ ${expectedMaxHours.toFixed(2)}h/week limit`,
          '',
          '📊 Calculated Work Week:',
          `  Base hours: 37.5h × ${plan.work_percent}% = ${baseWeeklyHours.toFixed(2)}h`,
          '',
          '  Bonus Hours:',
          `    Night hours ${nightHoursLabel}: ${totalNightHoursTariff.toFixed(2)}h`,
          `    Sunday hours: ${sundayOnlyHours.toFixed(2)}h (${totalSundayHours.toFixed(2)}h - ${totalOverlapHours.toFixed(2)}h overlap with night)`,
          '',
          `    Night bonus (15 min/hour): ${totalNightHoursTariff.toFixed(2)}h × 0.25 = ${(totalNightHoursTariff * 0.25).toFixed(2)}h`,
          `    Sunday bonus (10 min/hour): ${sundayOnlyHours.toFixed(2)}h × ${(10/60).toFixed(4)} = ${sundayBonus.toFixed(2)}h`,
          `    Sunday bonus adjusted by work %: ${sundayBonus.toFixed(2)}h × ${plan.work_percent}% = ${sundayBonusAdjusted.toFixed(2)}h`,
          '',
          `  Total bonus hours: ${totalBonusHours.toFixed(2)}h`,
          `  Average bonus per week: ${totalBonusHours.toFixed(2)}h ÷ ${plan.duration_weeks} weeks = ${avgBonusPerWeek.toFixed(2)}h`,
          '',
          `  Calculated: ${baseWeeklyHours.toFixed(2)}h - ${avgBonusPerWeek.toFixed(2)}h = ${calculatedWorkWeek.toFixed(2)}h`,
          `  Minimum: ${minimumWorkWeek.toFixed(2)}h (33.6h × ${plan.work_percent}%)`,
          `  → Final work week: ${finalWorkWeek.toFixed(2)}h`,
          '',
          '35.5h work week qualification:',
          `  ${meetsNightHours35 ? '✓' : '✗'} Night hours (20:00-06:00): ${avgNightHoursPerWeek20to6.toFixed(2)}h/week (required: ${requiredNightHours}h/week)`,
          `  ✓ Sunday work: Already met above`
        ]
      } else {
        result.message = `✅ Qualifies for 35.5h work week → Work week: ${expectedMaxHours.toFixed(2)}h/week (currently ${actualAvgHoursPerWeek.toFixed(2)}h/week)`
        result.details = [
          '✅ Qualifies for 35.5h work week:',
          `  ${meetsNightHours35 ? '✓' : '✗'} Night hours (20:00-06:00): ${avgNightHoursPerWeek20to6.toFixed(2)}h/week (required: ${requiredNightHours}h/week)`,
          `  ${meetsSundayRequirement ? '✓' : '✗'} Sunday work: ${sundaysWorked}/${totalSundays} Sundays (1 in ${sundayWorkRatio.toFixed(1)}, required: 1 in ${requiredSundayFreq})`,
          `  ✓ Actual hours: ${actualAvgHoursPerWeek.toFixed(2)}h/week ≤ ${expectedMaxHours.toFixed(2)}h/week limit (35.5h × ${plan.work_percent}%)`,
          '',
          '33.6h work week qualification:',
          `  ${has24HourCoverage ? '✓' : '✗'} 24-hour coverage: ${has24HourCoverage ? 'YES' : 'NO'}`,
          `  ${meetsSundayRequirement ? '✓' : '✗'} Sunday work: Already checked above`,
          `  ${meetsNonNightRequirement ? '✓' : '✗'} Non-night hours: ${nonNightPercent.toFixed(1)}% (required: ${requiredNonNightPercent}%)`
        ]
      }
    } else if (exceedsHourLimit) {
      // Qualifies for reduced week but exceeds hour limit
      result.status = 'fail'
      
      if (qualifiesFor33_6) {
        result.message = `✓ Qualifies for 33.6h work week BUT ✗ EXCEEDS hour limit → Reduce to ${expectedMaxHours.toFixed(2)}h/week (currently ${actualAvgHoursPerWeek.toFixed(2)}h/week)`
      } else {
        result.message = `✓ Qualifies for 35.5h work week BUT ✗ EXCEEDS hour limit → Reduce to ${expectedMaxHours.toFixed(2)}h/week (currently ${actualAvgHoursPerWeek.toFixed(2)}h/week)`
      }
      
      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: hourLimitMessage
      }]
    } else {
      result.status = 'fail'
      result.message = `✗ Does NOT qualify for reduced work week → Remains at standard 37.5h × ${plan.work_percent}% = ${baseWeeklyHours.toFixed(2)}h/week`
      
      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: 'Does not meet requirements for either 35.5h or 33.6h work week'
      }]
    }

    // Add detailed breakdown to all results
    if (!result.details) {
      result.details = [
        `Night hours (20:00-06:00): ${avgNightHoursPerWeek20to6.toFixed(2)}h/week (required: ${requiredNightHours}h/week)`,
        `Sunday work: ${sundaysWorked}/${totalSundays} Sundays (1 in ${sundayWorkRatio.toFixed(1)}, required: 1 in ${requiredSundayFreq})`,
        `24-hour coverage: ${has24HourCoverage ? 'YES' : 'NO'}`,
        `Non-night hours: ${nonNightPercent.toFixed(1)}% (required: ${requiredNonNightPercent}%)`
      ]
    }

    return result
  }
}

// Helper type for Sunday zones
interface SundayZone {
  startDateTime: Date
  endDateTime: Date
}

/**
 * Create Sunday zones manually (Saturday 18:00 - Sunday 22:00)
 */
function createSundayZones(planStartDate: string, durationWeeks: number): SundayZone[] {
  const zones: SundayZone[] = []
  const start = new Date(planStartDate)
  
  // Find the first Monday of the plan
  const startDayOfWeek = start.getDay()
  const daysUntilMonday = startDayOfWeek === 0 ? 1 : (8 - startDayOfWeek) % 7
  const firstMonday = new Date(start)
  if (daysUntilMonday > 0) {
    firstMonday.setDate(firstMonday.getDate() + daysUntilMonday)
  }
  
  for (let week = 0; week < durationWeeks; week++) {
    // Calculate the Saturday of this week
    const weekStart = new Date(firstMonday)
    weekStart.setDate(weekStart.getDate() + (week * 7))
    
    const saturday = new Date(weekStart)
    saturday.setDate(saturday.getDate() + 5) // Saturday is 5 days after Monday
    
    const sunday = new Date(weekStart)
    sunday.setDate(sunday.getDate() + 6) // Sunday is 6 days after Monday
    
    // Sunday zone: Saturday 18:00 - Sunday 22:00
    const zoneStart = new Date(saturday)
    zoneStart.setHours(18, 0, 0, 0)
    
    const zoneEnd = new Date(sunday)
    zoneEnd.setHours(22, 0, 0, 0)
    
    zones.push({
      startDateTime: zoneStart,
      endDateTime: zoneEnd
    })
  }
  
  return zones
}

/**
 * Calculate night hours for the special 20:00-06:00 period
 * This is different from the standard night hours calculation
 * Used for 35.5h work week qualification
 */
function calculateNightHours20to6(startTime: string, endTime: string): number {
  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const startMinutes = parseTime(startTime)
  let endMinutes = parseTime(endTime)
  
  // Handle shifts crossing midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  // Night period: 20:00 (1200 minutes) to 06:00 next day (360 minutes + 1440)
  const nightStart = 20 * 60 // 20:00 = 1200 minutes
  const midnight = 24 * 60 // 1440 minutes
  const nightEndAfterMidnight = 6 * 60 // 06:00 = 360 minutes

  let nightHours = 0

  // Period 1: 20:00 to midnight (if shift includes this)
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
 * Calculate total shift hours
 */
function calculateShiftHours(startTime: string, endTime: string): number {
  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const startMinutes = parseTime(startTime)
  let endMinutes = parseTime(endTime)
  
  // Handle shifts crossing midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  return (endMinutes - startMinutes) / 60
}

/**
 * Check if the plan has 24-hour coverage
 * Returns true if there are shifts covering all hours of the day with no gaps
 */
function check24HourCoverage(rotations: Rotation[], shifts: Shift[]): boolean {
  // Collect all unique shift time ranges
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
        
        // For night shifts, need to handle the wrap-around
        if (endMinutes < startMinutes) {
          // Night shift crosses midnight - split into two ranges
          timeRanges.push({ start: startMinutes, end: 24 * 60 }) // Before midnight
          timeRanges.push({ start: 0, end: endMinutes }) // After midnight
        } else {
          timeRanges.push({ start: startMinutes, end: endMinutes })
        }
      }
    }
  })

  if (timeRanges.length === 0) return false

  // Sort ranges by start time
  timeRanges.sort((a, b) => a.start - b.start)

  // Merge overlapping ranges
  const mergedRanges: Array<{ start: number; end: number }> = [timeRanges[0]]
  
  for (let i = 1; i < timeRanges.length; i++) {
    const current = timeRanges[i]
    const last = mergedRanges[mergedRanges.length - 1]
    
    if (current.start <= last.end) {
      // Overlapping or adjacent - merge
      last.end = Math.max(last.end, current.end)
    } else {
      // Gap found - not 24-hour coverage
      return false
    }
  }

  // Check if merged ranges cover the full day (0 to 1440 minutes)
  // Should have exactly one range from 0 to 1440
  return mergedRanges.length === 1 && 
         mergedRanges[0].start === 0 && 
         mergedRanges[0].end === 24 * 60
}

/**
 * Calculate Sunday hours for a specific rotation
 */
function calculateSundayHoursForRotation(
  rotation: Rotation,
  shift: Shift,
  planStartDate: string,
  durationWeeks: number
): number {
  if (!shift.start_time || !shift.end_time) return 0

  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const startMinutes = parseTime(shift.start_time)
  const endMinutes = parseTime(shift.end_time)
  const isNightShift = endMinutes < startMinutes

  // Get Sunday zones
  const sundayZones = createSundayZones(planStartDate, durationWeeks)

  // Find the Sunday zone for this rotation's week
  const zone = sundayZones[rotation.week_index]
  if (!zone) return 0

  // Calculate actual shift DateTime range
  const planStart = new Date(planStartDate)
  const firstMonday = new Date(planStart)
  const startDayOfWeek = planStart.getDay()
  const daysUntilMonday = startDayOfWeek === 0 ? 1 : (8 - startDayOfWeek) % 7
  if (daysUntilMonday > 0) {
    firstMonday.setDate(firstMonday.getDate() + daysUntilMonday)
  }
  
  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  if (rotation.day_of_week === 0 && isNightShift) {
    // Monday night shift - starts Sunday
    const baseDate = new Date(firstMonday)
    baseDate.setDate(baseDate.getDate() + (rotation.week_index * 7) + rotation.day_of_week - 1)
    shiftStartDateTime = new Date(baseDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    const mondayDate = new Date(baseDate)
    mondayDate.setDate(mondayDate.getDate() + 1)
    shiftEndDateTime = new Date(mondayDate)
    shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  } else if (rotation.day_of_week === 6 && isNightShift) {
    // Sunday night shift - starts Saturday
    const baseDate = new Date(firstMonday)
    baseDate.setDate(baseDate.getDate() + (rotation.week_index * 7) + rotation.day_of_week - 1)
    shiftStartDateTime = new Date(baseDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    const sundayDate = new Date(baseDate)
    sundayDate.setDate(sundayDate.getDate() + 1)
    shiftEndDateTime = new Date(sundayDate)
    shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  } else {
    // Regular shift
    const shiftDate = new Date(firstMonday)
    shiftDate.setDate(shiftDate.getDate() + (rotation.week_index * 7) + rotation.day_of_week)
    
    shiftStartDateTime = new Date(shiftDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    if (isNightShift) {
      const nextDay = new Date(shiftDate)
      nextDay.setDate(nextDay.getDate() + 1)
      shiftEndDateTime = new Date(nextDay)
      shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
    } else {
      shiftEndDateTime = new Date(shiftDate)
      shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
    }
  }

  // Calculate overlap with Sunday zone
  const overlapStart = shiftStartDateTime > zone.startDateTime ? shiftStartDateTime : zone.startDateTime
  const overlapEnd = shiftEndDateTime < zone.endDateTime ? shiftEndDateTime : zone.endDateTime

  if (overlapStart < overlapEnd) {
    const overlapMillis = overlapEnd.getTime() - overlapStart.getTime()
    return overlapMillis / (1000 * 60 * 60)
  }

  return 0
}

/**
 * Calculate hours that are BOTH night (21:00-06:00) AND Sunday
 * These hours should only get the higher bonus (15 minutes per hour)
 */
function calculateNightSundayOverlap(
  rotation: Rotation,
  shift: Shift,
  planStartDate: string,
  durationWeeks: number
): number {
  if (!shift.start_time || !shift.end_time) return 0

  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const startMinutes = parseTime(shift.start_time)
  const endMinutes = parseTime(shift.end_time)
  const isNightShift = endMinutes < startMinutes

  // Get Sunday zones
  const sundayZones = createSundayZones(planStartDate, durationWeeks)

  const zone = sundayZones[rotation.week_index]
  if (!zone) return 0

  // Calculate actual shift DateTime range
  const planStart = new Date(planStartDate)
  const firstMonday = new Date(planStart)
  const startDayOfWeek = planStart.getDay()
  const daysUntilMonday = startDayOfWeek === 0 ? 1 : (8 - startDayOfWeek) % 7
  if (daysUntilMonday > 0) {
    firstMonday.setDate(firstMonday.getDate() + daysUntilMonday)
  }
  
  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  if (rotation.day_of_week === 0 && isNightShift) {
    const baseDate = new Date(firstMonday)
    baseDate.setDate(baseDate.getDate() + (rotation.week_index * 7) + rotation.day_of_week - 1)
    shiftStartDateTime = new Date(baseDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    const mondayDate = new Date(baseDate)
    mondayDate.setDate(mondayDate.getDate() + 1)
    shiftEndDateTime = new Date(mondayDate)
    shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  } else if (rotation.day_of_week === 6 && isNightShift) {
    const baseDate = new Date(firstMonday)
    baseDate.setDate(baseDate.getDate() + (rotation.week_index * 7) + rotation.day_of_week - 1)
    shiftStartDateTime = new Date(baseDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    const sundayDate = new Date(baseDate)
    sundayDate.setDate(sundayDate.getDate() + 1)
    shiftEndDateTime = new Date(sundayDate)
    shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  } else {
    const shiftDate = new Date(firstMonday)
    shiftDate.setDate(shiftDate.getDate() + (rotation.week_index * 7) + rotation.day_of_week)
    
    shiftStartDateTime = new Date(shiftDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    if (isNightShift) {
      const nextDay = new Date(shiftDate)
      nextDay.setDate(nextDay.getDate() + 1)
      shiftEndDateTime = new Date(nextDay)
      shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
    } else {
      shiftEndDateTime = new Date(shiftDate)
      shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
    }
  }

  // Calculate overlap with Sunday zone
  const sundayOverlapStart = shiftStartDateTime > zone.startDateTime ? shiftStartDateTime : zone.startDateTime
  const sundayOverlapEnd = shiftEndDateTime < zone.endDateTime ? shiftEndDateTime : zone.endDateTime

  if (sundayOverlapStart >= sundayOverlapEnd) return 0 // No Sunday overlap

  // Now calculate which part of this Sunday overlap is also night time (21:00-06:00)
  // Night periods: 21:00-midnight and midnight-06:00
  
  let overlapHours = 0

  // Iterate through each hour in the Sunday overlap and check if it's night time
  const currentTime = new Date(sundayOverlapStart)
  while (currentTime < sundayOverlapEnd) {
    const hour = currentTime.getHours()
    
    // Check if this hour is in night period (21:00-06:00)
    const isNightHour = hour >= 21 || hour < 6
    
    if (isNightHour) {
      // Calculate how much of this hour overlaps
      const nextHour = new Date(currentTime)
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
      
      const periodEnd = nextHour < sundayOverlapEnd ? nextHour : sundayOverlapEnd
      const periodMillis = periodEnd.getTime() - currentTime.getTime()
      overlapHours += periodMillis / (1000 * 60 * 60)
    }
    
    // Move to next hour
    currentTime.setHours(currentTime.getHours() + 1, 0, 0, 0)
  }

  return overlapHours
}

/**
 * Calculate overlap between a shift and a Sunday time zone
 * 
 * @param dayOfWeek - Day the shift is PLACED on in the grid (5=Sat, 6=Sun, 0=Mon)
 * @param startTime - Shift start time (HH:MM:SS)
 * @param endTime - Shift end time (HH:MM:SS)
 * @param zone - Sunday time zone object
 * @param weekIndex - The week index to match dates
 * @param planStartDate - The plan start date
 * @returns Hours of overlap with Sunday zone (Saturday 18:00 - Sunday 22:00)
 */
function calculateSundayZoneOverlap(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  zone: SundayZone,
  weekIndex: number,
  planStartDate: string
): number {
  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const startMinutes = parseTime(startTime)
  const endMinutes = parseTime(endTime)
  
  // Check if this is a night shift (crosses midnight)
  const isNightShift = endMinutes < startMinutes

  // Create DateTime objects for the shift
  const planStart = new Date(planStartDate)
  const firstMonday = new Date(planStart)
  const startDayOfWeek = planStart.getDay()
  const daysUntilMonday = startDayOfWeek === 0 ? 1 : (8 - startDayOfWeek) % 7
  if (daysUntilMonday > 0) {
    firstMonday.setDate(firstMonday.getDate() + daysUntilMonday)
  }
  
  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  if (dayOfWeek === 0 && isNightShift) {
    // Monday NIGHT shift - starts on Sunday, ends on Monday
    const baseDate = new Date(firstMonday)
    baseDate.setDate(baseDate.getDate() + (weekIndex * 7) - 1) // Sunday
    
    shiftStartDateTime = new Date(baseDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    const mondayDate = new Date(baseDate)
    mondayDate.setDate(mondayDate.getDate() + 1) // Next day (Monday)
    
    shiftEndDateTime = new Date(mondayDate)
    shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  } else if (dayOfWeek === 6 && isNightShift) {
    // Sunday NIGHT shift - starts on Saturday, ends on Sunday
    const baseDate = new Date(firstMonday)
    baseDate.setDate(baseDate.getDate() + (weekIndex * 7) + 5) // Saturday
    
    shiftStartDateTime = new Date(baseDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    const sundayDate = new Date(baseDate)
    sundayDate.setDate(sundayDate.getDate() + 1) // Next day (Sunday)
    
    shiftEndDateTime = new Date(sundayDate)
    shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  } else {
    // Day shift OR other night shifts
    const shiftDate = new Date(firstMonday)
    shiftDate.setDate(shiftDate.getDate() + (weekIndex * 7) + dayOfWeek)
    
    shiftStartDateTime = new Date(shiftDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    if (isNightShift) {
      // Night shift crosses midnight (but not the special cases above)
      const nextDay = new Date(shiftDate)
      nextDay.setDate(nextDay.getDate() + 1)
      shiftEndDateTime = new Date(nextDay)
      shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
    } else {
      // Day shift - same day
      shiftEndDateTime = new Date(shiftDate)
      shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
    }
  }

  // Calculate overlap with the Sunday time zone
  const overlapStart = shiftStartDateTime > zone.startDateTime ? shiftStartDateTime : zone.startDateTime
  const overlapEnd = shiftEndDateTime < zone.endDateTime ? shiftEndDateTime : zone.endDateTime

  if (overlapStart < overlapEnd) {
    const overlapMillis = overlapEnd.getTime() - overlapStart.getTime()
    return overlapMillis / (1000 * 60 * 60) // Convert to hours
  }

  return 0
}