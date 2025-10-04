// src/lib/lawChecks/ThreeSplitAverageCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getSundayTimeZones } from '@/lib/utils/norwegianHolidayTimeZones'

/**
 * Three-Split Average Check
 * 
 * To qualify for 35.5h work week, the plan must meet one of these requirements:
 * 1. Average at least 1.39 hours of night work per week (20:00 day of - 06:00 next day)
 * 2. Work every 3rd Sunday on average
 * 
 * Legal Reference: Related to shift work compensation and scheduling requirements
 */
export const threeSplitAverageCheck: LawCheck = {
  id: 'three-split-average',
  name: 'Three-Split Average Qualification',
  description: 'Verifies if the plan qualifies for 35.5h work week through either: (1) averaging 1.39+ night hours per week (20:00-06:00), or (2) working every 3rd Sunday on average.',
  category: 'shared',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'HTA § 3.3.1 - Arbeidstid',
      url: 'https://www.nshf.no/tariff-og-arbeidsrett/sentrale-tariffavtaler/hovedtariffavtalen'
    }
  ],
  applicableTo: ['main', 'helping', 'year'],
  inputs: [
    {
      id: 'requiredNightHoursPerWeek',
      label: 'Required Average Night Hours per Week',
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
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const requiredNightHours = (inputs.requiredNightHoursPerWeek as number) || 1.39
    const requiredSundayFreq = (inputs.requiredSundayFrequency as number) || 3
    
    const result: LawCheckResult = {
      status: 'fail',
      message: '',
      details: [],
      violations: []
    }

    // Calculate night hours (20:00 to 06:00)
    let totalNightHours = 0
    
    rotations.forEach((rotation: Rotation) => {
      if (rotation.shift_id) {
        const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const nightHours = calculateNightHours20to6(shift.start_time, shift.end_time)
          totalNightHours += nightHours
        }
      }
    })

    const avgNightHoursPerWeek = totalNightHours / plan.duration_weeks

    // Check if night hours requirement is met
    const meetsNightRequirement = avgNightHoursPerWeek >= requiredNightHours

    // Get Sunday time zones for this plan
    const sundayZones = getSundayTimeZones(
      new Date(plan.date_started).getFullYear(),
      plan.date_started,
      plan.duration_weeks
    )

    // Count Sundays worked
    let sundaysWorked = 0
    const totalSundays = sundayZones.length

    sundayZones.forEach((zone, index) => {
      // Get the week index for this Sunday
      const weekIndex = Math.floor(index)
      
      // Sunday time zone spans Saturday 18:00 - Sunday 15:00
      // We need to check:
      // 1. Sunday shifts (day 6) - can overlap with zone until 15:00
      // 2. Monday shifts (day 0) - night shifts placed on Monday start late Sunday
      // We do NOT check Saturday shifts (day 5) because they start Friday night
      
      const sundayRotation = rotations.find((r: Rotation) => 
        r.week_index === weekIndex && r.day_of_week === 6 && r.shift_id
      )
      const mondayRotation = rotations.find((r: Rotation) => 
        r.week_index === weekIndex && r.day_of_week === 0 && r.shift_id
      )

      let hasSundayWork = false

      // Check if Sunday shift overlaps with Sunday zone (Saturday 18:00 - Sunday 15:00)
      if (sundayRotation) {
        const shift = shifts.find((s: Shift) => s.id === sundayRotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const overlapHours = calculateSundayZoneOverlap(
            6, // Sunday
            shift.start_time,
            shift.end_time,
            zone,
            weekIndex,
            plan.date_started
          )
          if (overlapHours > 0) {
            hasSundayWork = true
          }
        }
      }

      // Check if Monday shift overlaps with Sunday zone
      // Night shifts on Monday start late Sunday (e.g., 22:15 Sunday -> 07:45 Monday)
      if (!hasSundayWork && mondayRotation) {
        const shift = shifts.find((s: Shift) => s.id === mondayRotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const overlapHours = calculateSundayZoneOverlap(
            0, // Monday (but shift starts Sunday)
            shift.start_time,
            shift.end_time,
            zone,
            weekIndex,
            plan.date_started
          )
          if (overlapHours > 0) {
            hasSundayWork = true
          }
        }
      }

      if (hasSundayWork) {
        sundaysWorked++
      }
    })

    const sundayWorkRatio = totalSundays > 0 ? totalSundays / sundaysWorked : 0
    const meetsSundayRequirement = sundayWorkRatio <= requiredSundayFreq && sundaysWorked > 0

    // Build result
    const qualifies = meetsNightRequirement || meetsSundayRequirement

    if (qualifies) {
      result.status = 'pass'
      result.message = 'Plan qualifies for 35.5h work week'
      
      if (meetsNightRequirement && meetsSundayRequirement) {
        result.details = [
          `✓ Night hours requirement MET: ${avgNightHoursPerWeek.toFixed(2)}h/week average (required: ${requiredNightHours}h/week)`,
          `✓ Sunday work requirement MET: Working ${sundaysWorked} of ${totalSundays} Sundays (1 in ${sundayWorkRatio.toFixed(1)}, required: 1 in ${requiredSundayFreq})`,
          'Both requirements are satisfied'
        ]
      } else if (meetsNightRequirement) {
        result.details = [
          `✓ Night hours requirement MET: ${avgNightHoursPerWeek.toFixed(2)}h/week average (required: ${requiredNightHours}h/week)`,
          `✗ Sunday work requirement NOT MET: Working ${sundaysWorked} of ${totalSundays} Sundays (1 in ${sundayWorkRatio.toFixed(1)}, required: 1 in ${requiredSundayFreq})`,
          'Qualifies through night hours'
        ]
      } else {
        result.details = [
          `✗ Night hours requirement NOT MET: ${avgNightHoursPerWeek.toFixed(2)}h/week average (required: ${requiredNightHours}h/week)`,
          `✓ Sunday work requirement MET: Working ${sundaysWorked} of ${totalSundays} Sundays (1 in ${sundayWorkRatio.toFixed(1)}, required: 1 in ${requiredSundayFreq})`,
          'Qualifies through Sunday work'
        ]
      }
    } else {
      result.status = 'fail'
      result.message = 'Plan does NOT qualify for 35.5h work week'
      result.details = [
        `✗ Night hours requirement NOT MET: ${avgNightHoursPerWeek.toFixed(2)}h/week average (required: ${requiredNightHours}h/week)`,
        `  Total night hours: ${totalNightHours.toFixed(2)}h across ${plan.duration_weeks} weeks`,
        `✗ Sunday work requirement NOT MET: Working ${sundaysWorked} of ${totalSundays} Sundays (1 in ${sundayWorkRatio.toFixed(1)}, required: 1 in ${requiredSundayFreq})`,
        '',
        'Must meet at least one requirement to qualify for 35.5h work week'
      ]
      
      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: 'Does not meet either night hours or Sunday work requirements'
      }]
    }

    return result
  }
}

/**
 * Calculate night hours for the special 20:00-06:00 period
 * This is different from the standard night hours calculation
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
 * Calculate overlap between a shift and a Sunday time zone
 * Uses actual zone data from norwegianHolidayTimeZones.ts
 * 
 * @param dayOfWeek - Day the shift is PLACED on (6=Sunday, 0=Monday for night shifts)
 * @param startTime - Shift start time (HH:MM:SS)
 * @param endTime - Shift end time (HH:MM:SS)
 * @param zone - Sunday time zone object from getSundayTimeZones()
 * @param weekIndex - The week index to match dates
 * @param planStartDate - The plan start date
 * @returns Hours of overlap
 */
function calculateSundayZoneOverlap(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  zone: any, // HolidayTimeZone type from norwegianHolidayTimeZones
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
  
  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  if (dayOfWeek === 0 && isNightShift) {
    // Monday night shift - starts on Sunday, ends on Monday
    // The shift is PLACED on Monday but STARTS on Sunday
    const sundayDate = new Date(planStart)
    sundayDate.setDate(sundayDate.getDate() + (weekIndex * 7) + 6) // Sunday is day 6
    
    shiftStartDateTime = new Date(sundayDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    const mondayDate = new Date(sundayDate)
    mondayDate.setDate(mondayDate.getDate() + 1) // Next day (Monday)
    
    shiftEndDateTime = new Date(mondayDate)
    shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  } else {
    // Regular shift or Sunday shift
    const shiftDate = new Date(planStart)
    shiftDate.setDate(shiftDate.getDate() + (weekIndex * 7) + dayOfWeek)
    
    shiftStartDateTime = new Date(shiftDate)
    shiftStartDateTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
    
    if (isNightShift) {
      // Shift crosses midnight
      const nextDay = new Date(shiftDate)
      nextDay.setDate(nextDay.getDate() + 1)
      shiftEndDateTime = new Date(nextDay)
      shiftEndDateTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
    } else {
      // Same day
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