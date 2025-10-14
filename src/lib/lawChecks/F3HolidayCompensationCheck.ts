// src/lib/lawChecks/F3HolidayCompensationCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'

/**
 * F3 Holiday Compensation Check (Helping Plans Only)
 * 
 * Three calculation methods:
 * 1. Hovudregelen (Annenhver rød dag fri) - Main rule: Every other red day off
 * 2. Annenhver beregning og fri fordeling - Every other calculation with free distribution
 * 3. Gjennomsnittsberegning - Average calculation
 */
export const f3HolidayCompensationCheck: LawCheck = {
  id: 'f3-holiday-compensation',
  name: 'F3 Holiday Compensation (Helping Plans)',
  description: 'Verifies F3 shifts are properly placed on actual red days (not just in time zone) after work on holidays, and that they reduce total work hours.',
  category: 'helping',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'AML §10-10 - Søn- og helgedagsarbeid',
      url: 'https://lovdata.no/lov/2005-06-17-62/§10-10'
    }
  ],
  inputs: [
    {
      id: 'ignoreLessThanOrEqualTo',
      label: 'Ignore Work Less Than or Equal To',
      type: 'number',
      defaultValue: 1,
      min: 0,
      max: 24,
      step: 0.25,
      unit: 'hours'
    }
  ],

  run: ({ rotations, shifts, plan, basePlanRotations, basePlanShifts, basePlan, inputs = {} }) => {
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

    const calculationMethod = (inputs.calculationMethod as string) || 'hovedregelen'
    const ignoreLessThanOrEqualTo = (inputs.ignoreLessThanOrEqualTo as number) ?? 1

    let methodName: string
    switch (calculationMethod) {
      case 'hovedregelen':
        methodName = 'Hovudregelen (Annenhver rød dag fri)'
        break
      case 'annenhver':
        methodName = 'Annenhver beregning og fri fordeling'
        break
      case 'gjennomsnitt':
        methodName = 'Gjennomsnittsberegning'
        break
      default:
        methodName = 'Hovudregelen (Annenhver rød dag fri)'
    }

    if (plan.type !== 'helping') {
      return {
        status: 'warning',
        message: 'This check only applies to helping plans',
        details: ['F3 holiday compensation is specifically for helping plans']
      }
    }

    if (!plan.base_plan_id) {
      return {
        status: 'warning',
        message: 'No base plan found',
        details: ['Helping plans must have a base plan to check F3 compensation']
      }
    }

    if (!basePlanRotations || !basePlanShifts || !basePlan) {
      return {
        status: 'warning',
        message: 'Base plan data not available',
        details: ['Cannot analyze F3 compensation without base plan data']
      }
    }

    const f3Shift = shifts.find((s: Shift) => s.name === 'F3' && s.is_default)

    if (!f3Shift) {
      return {
        status: 'warning',
        message: 'F3 shift type not found in helping plan',
        details: ['F3 shifts are required for holiday compensation']
      }
    }

    const maxWeek = Math.max(...basePlanRotations.map(r => r.week_index))
    const basePlanRotationLength = maxWeek + 1

    const basePlanStartDate = new Date(basePlan.date_started)
    const helpingPlanStartDate = new Date(plan.date_started)
    const diffTime = helpingPlanStartDate.getTime() - basePlanStartDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffWeeks = Math.floor(diffDays / 7)
    let weekOffset = diffWeeks % basePlanRotationLength
    if (weekOffset < 0) weekOffset += basePlanRotationLength

    const helpingPlanEndDate = new Date(helpingPlanStartDate)
    helpingPlanEndDate.setDate(helpingPlanEndDate.getDate() + plan.duration_weeks * 7)

    const effectiveRotations: Rotation[] = []
    for (let helpingWeek = 0; helpingWeek < plan.duration_weeks; helpingWeek++) {
      const baseRotationWeek = (helpingWeek + weekOffset) % basePlanRotationLength
      const baseWeekRotations = basePlanRotations.filter(r => r.week_index === baseRotationWeek)
      baseWeekRotations.forEach(baseRotation => {
        effectiveRotations.push({
          ...baseRotation,
          week_index: helpingWeek,
          plan_id: plan.id
        })
      })
    }

    const startYear = helpingPlanStartDate.getFullYear()
    const endYear = helpingPlanEndDate.getFullYear()

    const allTimeZones: HolidayTimeZone[] = []
    for (let year = startYear; year <= endYear; year++) {
      allTimeZones.push(...getHolidayTimeZones(year))
    }
    allTimeZones.push(...createSundayTimeZones(helpingPlanStartDate, helpingPlanEndDate))

    const relevantTimeZones = allTimeZones.filter(zone =>
      zone.startDateTime < helpingPlanEndDate && zone.endDateTime > helpingPlanStartDate
    )
    relevantTimeZones.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

    const zonesWorked: Array<{
      zone: HolidayTimeZone
      overlapHours: number
      rotations: Array<{ rotation: Rotation; shift: Shift; hours: number }>
    }> = []

    relevantTimeZones.forEach(zone => {
      let totalOverlapHours = 0
      const rotationsInZone: Array<{ rotation: Rotation; shift: Shift; hours: number }> = []

      effectiveRotations.forEach(rotation => {
        if (!rotation.shift_id) return
        const shift = basePlanShifts.find(s => s.id === rotation.shift_id)
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

        const overlapHours = calculateTimeZoneOverlap(rotation, shift, zone, helpingPlanStartDate)
        if (overlapHours > 0) {
          totalOverlapHours += overlapHours
          rotationsInZone.push({ rotation, shift, hours: overlapHours })
        }
      })

      zonesWorked.push({ zone, overlapHours: totalOverlapHours, rotations: rotationsInZone })
    })

    const f3Rotations = rotations.filter(r => {
      const shift = shifts.find(s => s.id === r.shift_id)
      return shift?.name === 'F3'
    })

    result.details = [
      `Method: ${methodName}`,
      `Ignore work ≤ ${ignoreLessThanOrEqualTo}h`,
      `Base rotation length: ${basePlanRotationLength} weeks`,
      `Helping plan period: ${plan.date_started} to ${formatDateLocal(helpingPlanEndDate)} (${plan.duration_weeks} weeks)`,
      `Week offset: ${weekOffset}`,
      `Holiday/Sunday zones worked: ${zonesWorked.length}`,
      `Total hours in zones: ${zonesWorked.reduce((sum, zw) => sum + zw.overlapHours, 0).toFixed(2)}h`,
      `F3 compensation shifts: ${f3Rotations.length}`,
      ''
    ]

    const effectiveBaseHours = calculateTotalWorkHours(effectiveRotations, basePlanShifts)
    const helpingHours = calculateTotalWorkHours(rotations, shifts)
    const f3ReplacedHours = calculateF3ReplacedHours(
      effectiveRotations,
      rotations,
      basePlanShifts,
      shifts,
      f3Shift.id
    )
    const totalHourReduction = effectiveBaseHours - helpingHours

    result.details.push('=== Hours Comparison ===')
    result.details.push(`Effective base hours: ${effectiveBaseHours.toFixed(2)}h`)
    result.details.push(`Helping plan hours: ${helpingHours.toFixed(2)}h`)
    result.details.push(`Total reduction: ${totalHourReduction.toFixed(2)}h`)
    result.details.push(`F3 reduction: ${f3ReplacedHours.toFixed(2)}h`)
    const f5ReplacedHours = totalHourReduction - f3ReplacedHours
    if (f5ReplacedHours > 0) {
      result.details.push(`F5 reduction: ${f5ReplacedHours.toFixed(2)}h`)
    }
    if (totalHourReduction <= 0) result.details.push(`⚠️ WARNING: No hour reduction!`)
    if (f3ReplacedHours <= 0) result.details.push(`⚠️ WARNING: F3 shifts not reducing hours!`)
    result.details.push('')

    // ===================== HOVUDREGELEN (fixed for F3 chain) =====================
    if (calculationMethod === 'hovedregelen') {
      result.details.push('=== Hovudregelen Analysis ===\n');

      // Build map of ALL red days, including those with zero overlap
      const redDayDates: string[] = relevantTimeZones.map(zone => {
        const d = new Date(zone.endDateTime);
        d.setHours(0, 0, 0, 0);
        return formatDateLocal(d);
      }).sort();

      result.details.push(`All red days in period: ${redDayDates.join(', ')}`);

      // Mark which red days are actually worked (over ignore threshold)
      const workedRedDayFlags: Record<string, boolean> = {};
      redDayDates.forEach(date => {
        const worked = zonesWorked.some(
          zw => formatDateLocal(new Date(zw.zone.endDateTime)) === date &&
                zw.overlapHours > ignoreLessThanOrEqualTo
        );
        workedRedDayFlags[date] = worked;
      });

      result.details.push('Initial worked red day flags: ' + JSON.stringify(workedRedDayFlags));

      let requiredF3Count = 0;
      const violationDetails: string[] = [];

      // Iterate over red days
      for (let i = 0; i < redDayDates.length - 1; i++) {
        const today = redDayDates[i];
        const nextDay = redDayDates[i + 1];

        // Only trigger F3 if today and nextDay are worked
        if (workedRedDayFlags[today] && workedRedDayFlags[nextDay]) {
          requiredF3Count++;

          // Mark next day as compensated (off now)
          workedRedDayFlags[nextDay] = false;

          violationDetails.push(`F3 required on ${nextDay} after working ${today}`);
        }
      }

      // Log summary
      result.details.push('--- Hovudregelen F3 requirements ---');
      violationDetails.forEach(line => result.details?.push(line));
      result.details.push(`Total F3 required: ${requiredF3Count}`);
      result.details.push(`F3 shifts in plan: ${f3Rotations.length}`);

      if (f3Rotations.length < requiredF3Count) {
        result.status = 'fail';
        result.message = `Hovudregelen: Not enough F3 shifts (${f3Rotations.length} provided, ${requiredF3Count} required)`;
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Need ${requiredF3Count} F3 shifts but only ${f3Rotations.length} provided`
        });
      } else {
        result.status = 'pass';
        result.message = `Hovudregelen: F3 shifts properly applied (${requiredF3Count})`;
      }

      return result;
}
    // ===================== ANNENHVER MED GJENNOMSNITT LOGIC (fixed) =====================
    if (calculationMethod === 'annenhver') {
      result.details.push('=== Annenhver Beregning Analysis ===\n')

      // Build map of ALL red days, including those with zero overlap
      const redDayDates: Set<string> = new Set()
      relevantTimeZones.forEach(zone => {
        const d = new Date(zone.endDateTime)
        d.setHours(0, 0, 0, 0)
        redDayDates.add(formatDateLocal(d))
      })

      const sortedRedDayDates = Array.from(redDayDates).sort()
      result.details.push(`Red days in period: ${sortedRedDayDates.join(', ')}`)
      result.details.push('')

      // Count consecutive worked sequences to determine F3 required
      let requiredF3Count = 0
      let currentSequence: string[] = []
      const sequenceDetails: string[] = []

      for (let i = 0; i < sortedRedDayDates.length; i++) {
        const date = sortedRedDayDates[i]
        const workedToday = zonesWorked.some(zw =>
          formatDateLocal(new Date(zw.zone.endDateTime)) === date && zw.overlapHours > ignoreLessThanOrEqualTo
        )

        if (workedToday) {
          currentSequence.push(date)
        } else if (currentSequence.length > 0) {
          const earned = Math.floor(currentSequence.length / 2)
          if (earned > 0) {
            sequenceDetails.push(
              `Sequence: [${currentSequence.join(', ')}] → ${earned} F3`
            )
          } else {
            sequenceDetails.push(
              `Sequence: [${currentSequence.join(', ')}] → No F3 (only ${currentSequence.length} red day${currentSequence.length > 1 ? 's' : ''} worked)`
            )
          }
          requiredF3Count += earned
          currentSequence = []
        }
      }

      // Handle last sequence if it ended at the end of the array
      if (currentSequence.length > 0) {
        const earned = Math.floor(currentSequence.length / 2)
        if (earned > 0) {
          sequenceDetails.push(
            `Sequence: [${currentSequence.join(', ')}] → ${earned} F3`
          )
        } else {
          sequenceDetails.push(
            `Sequence: [${currentSequence.join(', ')}] → No F3`
          )
        }
        requiredF3Count += earned
      }

      // Log summary
      result.details.push('--- Sequence breakdown ---')
      sequenceDetails.forEach(line => result.details?.push(line))
      result.details.push(`Total F3 required: ${requiredF3Count}`)
      result.details.push('')

      // Calculate worked red days set for reporting
      const workedRedDays = sortedRedDayDates.filter(date =>
        zonesWorked.some(zw => formatDateLocal(new Date(zw.zone.endDateTime)) === date && zw.overlapHours > ignoreLessThanOrEqualTo)
      )

      result.details.push(`Worked red days (>${ignoreLessThanOrEqualTo}h): ${workedRedDays.length}`)
      result.details.push(`Total F3 required by sequences: ${requiredF3Count}`)
      result.details.push(`Total F3 provided: ${f3Rotations.length}`)
      result.details.push('')

      const totalRedDaysInPeriod = sortedRedDayDates.length
      const maxAllowedWorkDays = Math.floor(totalRedDaysInPeriod / 2)
      const workedMoreThanHalf = workedRedDays.length > maxAllowedWorkDays

      result.details.push(`Total red days in period: ${totalRedDaysInPeriod}`)
      result.details.push(`Max allowed work days (50%): ${maxAllowedWorkDays}`)
      result.details.push(`Days actually worked: ${workedRedDays.length}`)
      result.details.push('')

      let violationCount = 0

      if (f3Rotations.length < requiredF3Count) {
        result.details.push(`❌ Insufficient F3: Need ${requiredF3Count}, have ${f3Rotations.length}`)
        violationCount++
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Need ${requiredF3Count} F3 shifts but only ${f3Rotations.length} provided`
        })
      } else if (f3Rotations.length > requiredF3Count) {
        result.details.push(`ℹ️ Extra F3: Have ${f3Rotations.length - requiredF3Count} more than required`)
      } else {
        result.details.push(`✅ F3 count matches sequences requirement`)
      }

      if (workedMoreThanHalf) {
        result.details.push(`❌ Working too many red days: ${workedRedDays.length} > ${maxAllowedWorkDays} (max 50%)`)
        violationCount++
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Worked ${workedRedDays.length} red days, maximum allowed is ${maxAllowedWorkDays} (50% of ${totalRedDaysInPeriod})`
        })
      } else {
        result.details.push(`✅ Red day work within 50% limit`)
      }

      if (requiredF3Count > 0 && f3ReplacedHours <= 0) {
        result.details.push(`❌ F3 not reducing hours: F3 reduction ${f3ReplacedHours.toFixed(2)}h`)
        violationCount++
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `F3 shifts not reducing work hours`
        })
      } else {
        result.details.push(`✅ F3 reducing hours by ${f3ReplacedHours.toFixed(2)}h`)
      }

      // Check for F3 placed on non-red days
      const f3Dates = f3Rotations.map(f3r =>
        formatDateLocal(getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week))
      )
      const f3OnNonRedDays = f3Dates.filter(d => !sortedRedDayDates.includes(d))
      if (f3OnNonRedDays.length > 0) {
        result.details.push('')
        result.details.push('❌ F3 placed on non-red days:')
        f3OnNonRedDays.forEach(d => {
          result.details?.push(`  - ${d}`)
          violationCount++
          result.violations?.push({
            weekIndex: -1,
            dayOfWeek: -1,
            description: `F3 placed on non-red day ${d}`
          })
        })
      }

      if (violationCount > 0) {
        result.status = 'fail'
        result.message = `Annenhver: Found ${violationCount} violation(s)`
      } else if (workedRedDays.length === 0) {
        result.status = 'pass'
        result.message = `Annenhver: No significant red day work found (all work ≤${ignoreLessThanOrEqualTo}h)`
      } else {
        result.status = 'pass'
        result.message = `Annenhver: ${requiredF3Count} F3 required, ${f3Rotations.length} provided. All constraints met, F3 reducing ${f3ReplacedHours.toFixed(2)}h.`
      }

      return result
    } // end annenhver

    // ===================== GJENNOMSNITT (average) =====================
    if (calculationMethod === 'gjennomsnitt') {
      result.details.push('=== Gjennomsnittsberegning Analysis ===')
      result.details.push('')

      const shortOverlapZones = zonesWorked.filter(zw => zw.overlapHours <= ignoreLessThanOrEqualTo)
      const significantWorkZones = zonesWorked.filter(zw => zw.overlapHours > ignoreLessThanOrEqualTo)

      if (significantWorkZones.length === 0) {
        result.status = 'pass'
        result.message = `Gjennomsnitt: No significant red day work found (all work ≤${ignoreLessThanOrEqualTo}h)`
        if (shortOverlapZones.length > 0) {
          result.details.push(`ℹ️ All ${shortOverlapZones.length} zones have work ≤${ignoreLessThanOrEqualTo}h (ignored)`)
        }
        return result
      }

      const significantRedDayDates = new Set<string>()
      significantWorkZones.forEach(zw => {
        const zoneEnd = new Date(zw.zone.endDateTime)
        zoneEnd.setHours(0, 0, 0, 0)
        significantRedDayDates.add(formatDateLocal(zoneEnd))
      })

      const sortedRedDayDates = Array.from(significantRedDayDates).sort()

      const totalRedDaysInPeriod = relevantTimeZones.length
      const maxAllowedWorkDays = Math.floor(totalRedDaysInPeriod / 2)
      const workedMoreThanHalf = sortedRedDayDates.length > maxAllowedWorkDays

      result.details.push(`Total red days in period: ${totalRedDaysInPeriod}`)
      result.details.push(`Max allowed work days (50%, rounded down): ${maxAllowedWorkDays}`)
      result.details.push(`Days actually worked (>${ignoreLessThanOrEqualTo}h): ${sortedRedDayDates.length}`)
      result.details.push('')

      let violationCount = 0

      if (workedMoreThanHalf) {
        result.details.push(`❌ Worked ${sortedRedDayDates.length} red days, maximum allowed is ${maxAllowedWorkDays}`)
        violationCount++
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Worked ${sortedRedDayDates.length} red days, maximum allowed is ${maxAllowedWorkDays} (50% of ${totalRedDaysInPeriod}, rounded down)`
        })
      } else {
        result.details.push(`✅ Red day work within 50% limit (${sortedRedDayDates.length}/${maxAllowedWorkDays} days used)`)
      }

      if (sortedRedDayDates.length > 0 && f3ReplacedHours <= 0) {
        result.details.push(`❌ F3 not reducing hours: F3 reduction ${f3ReplacedHours.toFixed(2)}h`)
        violationCount++
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `F3 shifts not reducing work hours`
        })
      } else {
        result.details.push(`✅ F3 reducing hours by ${f3ReplacedHours.toFixed(2)}h`)
      }

      if (violationCount > 0) {
        result.status = 'fail'
        result.message = `Gjennomsnitt: Found ${violationCount} violation(s)`
      } else {
        result.status = 'pass'
        result.message = `Gjennomsnitt: ${sortedRedDayDates.length} of ${totalRedDaysInPeriod} red days worked (within 50% limit), F3 reducing ${f3ReplacedHours.toFixed(2)}h`
      }

      if (shortOverlapZones.length > 0) {
        result.details.push('')
        result.details.push(`ℹ️ ${shortOverlapZones.length} zones with work ≤${ignoreLessThanOrEqualTo}h ignored per agreement`)
      }

      return result
    }

    // default fallback
    return result
  } // end run
} // end export

/**
 * Calculate total work hours for a plan, excluding F5 shifts to avoid double-counting
 */
function calculateTotalWorkHours(
  rotations: Rotation[],
  shifts: Shift[]
): number {
  let totalHours = 0

  rotations.forEach((rotation: Rotation) => {
    if (rotation.shift_id) {
      const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)

      // Skip F5 shifts - they represent time off, not work
      if (shift && shift.name !== 'F5' && shift.start_time && shift.end_time) {
        const shiftHours = calculateShiftHours(shift.start_time, shift.end_time)
        totalHours += shiftHours
      }
    }
  })

  return totalHours
}

/**
 * Calculate hours specifically replaced by F3 shifts
 * (hours that were in base plan but replaced with F3 in helping plan)
 */
function calculateF3ReplacedHours(
  effectiveRotations: Rotation[],
  helpingRotations: Rotation[],
  baseShifts: Shift[],
  helpingShifts: Shift[],
  f3ShiftId: string
): number {
  let f3ReplacedHours = 0

  // Find all F3 rotations in helping plan
  const f3Rotations = helpingRotations.filter(r => r.shift_id === f3ShiftId)

  // For each F3 rotation, find what it replaced in the effective base rotations
  f3Rotations.forEach(f3Rotation => {
    const effectiveRotation = effectiveRotations.find(
      er => er.week_index === f3Rotation.week_index && er.day_of_week === f3Rotation.day_of_week
    )

    if (effectiveRotation && effectiveRotation.shift_id) {
      const replacedShift = baseShifts.find(s => s.id === effectiveRotation.shift_id)

      // Only count if it replaced actual work (not F5 or other default shifts)
      if (replacedShift && replacedShift.name !== 'F5' && !replacedShift.is_default &&
        replacedShift.start_time && replacedShift.end_time) {
        const replacedHours = calculateShiftHours(replacedShift.start_time, replacedShift.end_time)
        f3ReplacedHours += replacedHours
      }
    }
  })

  return f3ReplacedHours
}

/**
 * Given a planStartDate and rotation indices (week_index, day_of_week),
 * return the actual date for that rotation, using Monday-first indexing
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

function formatDateLocal(date: Date): string {
  // "YYYY-MM-DD" in Oslo local time
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
}

/**
 * Check if there's work during an F3 timezone period
 */
function checkF3WorkConflict(
  f3Date: Date,
  rotations: Rotation[],
  shifts: Shift[],
  planStartDate: Date,
  allTimeZones: HolidayTimeZone[]
): boolean {
  const f3DateStr = formatDateLocal(f3Date)

  const relevantZone = allTimeZones.find(zone => {
    const zoneMainDate = new Date(zone.endDateTime)
    zoneMainDate.setHours(0, 0, 0, 0)
    return formatDateLocal(zoneMainDate) === f3DateStr
  })

  if (!relevantZone) return false

  for (const rotation of rotations) {
    if (!rotation.shift_id) continue

    const shift = shifts.find(s => s.id === rotation.shift_id)

    if (!shift || shift.is_default || !shift.start_time || !shift.end_time) continue

    const overlap = calculateTimeZoneOverlap(
      rotation,
      shift,
      relevantZone,
      planStartDate
    )

    if (overlap > 0) {
      return true
    }
  }

  return false
}

function createSundayTimeZones(startDate: Date, endDate: Date): HolidayTimeZone[] {
  const zones: HolidayTimeZone[] = []
  const current = new Date(startDate)

  // move to first sunday on/after startDate
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

function calculateTimeZoneOverlap(
  rotation: Rotation,
  shift: Shift,
  zone: { startDateTime: Date; endDateTime: Date },
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
