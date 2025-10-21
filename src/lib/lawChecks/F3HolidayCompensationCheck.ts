// src/lib/lawChecks/F3HolidayCompensationCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'

/**
 * F3 Holiday Compensation Check (Helping Plans Only) - ZONE-BASED
 * 
 * Three calculation methods:
 * 1. Hovudregelen (Annenhver rød dag fri) - Main rule: Every other red ZONE off
 * 2. Annenhver beregning og fri fordeling - Every other ZONE with free distribution
 * 3. Gjennomsnittsberegning - Average ZONE calculation
 * 
 * KEY CHANGE: Now treats red day TIMEZONES as units, not calendar days
 * Example: Working Dec 24-25 in same timezone = 1 zone worked, not 2 days
 */
export const f3HolidayCompensationCheck: LawCheck = {
  id: 'f3-holiday-compensation',
  name: 'F3 helgedags fri',
  description: 'Verifiserer at F3-vakter er korrekt plasserte på faktiske rauddagssoner og dekkjer tidssona fullt ut (ingen arbeidskonfliktar). Dersom du går 50/50 langvakter og vanlege dag/kveld vakter er det naturleg at F3 dagar også reflekterer det. Det er ikkje noko som blir testa. (Grunnlag basert på grunnturnus eller rullerande årsturnus)',
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
      label: 'Ignorer overlapp raud tidssone lik',
      type: 'number',
      defaultValue: 1,
      min: 0,
      max: 24,
      step: 0.25,
      unit: 'timar'
    },
    {
      id: 'averageWeeks',
      label: 'Gjennomsnittsberegning',
      type: 'number',
      defaultValue: 26,
      min: 4,
      max: 52,
      step: 1,
      unit: 'veker',
      showIf: {
        field: 'calculationMethod',
        equals: 'gjennomsnitt'
      }
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
      const overlayShift = shifts.find(s => s.id === r.overlay_shift_id)
      return overlayShift?.name === 'F3' && r.overlay_type === 'f3_compensation'
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

    // ===================== HOVUDREGELEN (Zone-based) =====================
    if (calculationMethod === 'hovedregelen') {
      result.details.push('=== Hovudregelen Analysis (Zone-based) ===\n')

      // Identify which zones were worked (>ignoreLessThanOrEqualTo hours)
      const workedZones = zonesWorked.filter(zw => zw.overlapHours > ignoreLessThanOrEqualTo)
      
      result.details.push(`Total red day zones: ${relevantTimeZones.length}`)
      result.details.push(`Zones worked (>${ignoreLessThanOrEqualTo}h): ${workedZones.length}`)
      result.details.push('')

      // Track consecutive worked zones to determine F3 requirements
      const requiredF3Zones: HolidayTimeZone[] = []
      const violationDetails: string[] = []
      const workedZoneIndices = new Set(workedZones.map(zw => relevantTimeZones.indexOf(zw.zone)))

      for (let i = 0; i < relevantTimeZones.length - 1; i++) {
        const currentZone = relevantTimeZones[i]
        const nextZone = relevantTimeZones[i + 1]
        
        const currentWorked = workedZoneIndices.has(i)
        const nextWorked = workedZoneIndices.has(i + 1)

        if (currentWorked && nextWorked) {
          requiredF3Zones.push(nextZone)

          const nextZoneDate = formatDateLocal(new Date(nextZone.endDateTime))
          const currentZoneDate = formatDateLocal(new Date(currentZone.endDateTime))
          violationDetails.push(
            `F3 required for ${nextZone.localName} (${nextZoneDate}) after working ${currentZone.localName} (${currentZoneDate})`
          )

          // Remove next zone from further consecutive pairing
          workedZoneIndices.delete(i + 1)
        }
      }

      result.details.push('--- Hovudregelen F3 requirements ---')
      if (violationDetails.length > 0) {
        violationDetails.forEach(line => result.details?.push(line))
      } else {
        result.details?.push('No consecutive zones worked - no F3 required by Hovudregelen')
      }
      result.details.push('')
      result.details.push(`Total F3 required: ${requiredF3Zones.length}`)
      result.details.push(`F3 shifts in plan: ${f3Rotations.length}`)
      
      // === Check if F3s are exactly on required zones ===
      const requiredDates = requiredF3Zones.map(z => formatDateLocal(new Date(z.endDateTime)))
      const f3Dates = f3Rotations.map(f3r => {
        const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)
        return formatDateLocal(f3Date)
      })

      const missingDates = requiredDates.filter(d => !f3Dates.includes(d))
      const extraDates = f3Dates.filter(d => !requiredDates.includes(d))

      if (missingDates.length > 0) {
        result.details.push('')
        result.details.push('❌ Missing required F3s:')
        missingDates.forEach(d => result.details?.push(`  - ${d}`))
        missingDates.forEach(d => {
          result.violations?.push({
            weekIndex: -1,
            dayOfWeek: -1,
            description: `Missing F3 on required date ${d}`
          })
        })
      }

      if (extraDates.length > 0) {
        result.details.push('')
        result.details.push('⚠️ Extra F3s:')
        extraDates.forEach(d => result.details?.push(`  - ${d}`))
      }

      // === Check coverage of the timezones ===
      result.details.push('')
      result.details.push('--- F3 Timezone Coverage Check ---')
      let coverageViolations = 0

      f3Rotations.forEach(f3r => {
        const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)
        const f3DateStr = formatDateLocal(f3Date)

        // Find which red-day zone (if any) this F3 date falls into
        const matchedZone = relevantTimeZones.find(z => {
          const start = new Date(z.startDateTime)
          const end = new Date(z.endDateTime)
          return f3Date >= start && f3Date <= end
        })

        if (!matchedZone) {
          result.details?.push(`❌ F3 on ${f3DateStr} is NOT inside any red-day timezone`)
          result.violations?.push({
            weekIndex: f3r.week_index,
            dayOfWeek: f3r.day_of_week,
            description: `F3 on ${f3DateStr} not inside any red-day timezone`
          })
          coverageViolations++
          return // skip further coverage check
        }

        // Normal check for covering the matched zone
        const { covers, conflictDetails } = checkF3CoversTimezone(
          f3Date,
          effectiveRotations,
          basePlanShifts,
          helpingPlanStartDate,
          [matchedZone], // only check against this zone
          rotations,
          shifts,
          ignoreLessThanOrEqualTo
        )

        if (!covers) {
          result.details?.push(`❌ F3 on ${f3DateStr} does NOT fully cover timezone:`)
          conflictDetails.forEach(detail => {
            result.details?.push(`  - ${detail}`)
          })
          result.violations?.push({
            weekIndex: f3r.week_index,
            dayOfWeek: f3r.day_of_week,
            description: `F3 on ${f3DateStr} doesn't cover entire timezone - work shifts still present`
          })
          coverageViolations++
        } else {
          result.details?.push(`✅ F3 on ${f3DateStr} properly covers ${matchedZone.localName} (${formatDateLocal(new Date(matchedZone.endDateTime))})`)
        }
      })

      // === Determine final result ===
      if (missingDates.length > 0 || extraDates.length > 0 || coverageViolations > 0) {
        result.status = 'fail'
        if (missingDates.length > 0) {
          result.message = `Hovudregelen: Missing ${missingDates.length} required F3(s)`
        } else if (extraDates.length > 0) {
          result.message = `Hovudregelen: ${extraDates.length} extra/unneeded F3(s)`
        } else {
          result.message = `Hovudregelen: ${coverageViolations} F3 coverage issue(s)`
        }
      } else if (requiredF3Zones.length === 0) {
        result.status = 'pass'
        result.message = `Hovudregelen: No consecutive zones worked – no F3 required`
      } else {
        result.status = 'pass'
        result.message = `Hovudregelen: All required F3s correctly placed and covering zones`
      }

      return result
    }


        // ===================== ANNENHVER (Zone-based) =====================
    if (calculationMethod === 'annenhver') {
      result.details.push('=== Annenhver Beregning Analysis (Zone-based) ===\n')

      // Identify worked zones
      const workedZones = zonesWorked.filter(zw => zw.overlapHours > ignoreLessThanOrEqualTo)
      
      result.details.push(`Total red day zones in period: ${relevantTimeZones.length}`)
      result.details.push(`Zones worked (>${ignoreLessThanOrEqualTo}h): ${workedZones.length}`)
      result.details.push('')

      // Build sequences of consecutive worked zones
      let requiredF3Count = 0
      let currentSequence: HolidayTimeZone[] = []
      const sequenceDetails: string[] = []
      const workedZoneSet = new Set(workedZones.map(zw => zw.zone))

      for (let i = 0; i < relevantTimeZones.length; i++) {
        const zone = relevantTimeZones[i]
        const isWorked = workedZoneSet.has(zone)

        if (isWorked) {
          currentSequence.push(zone)
        } else if (currentSequence.length > 0) {
          // End of sequence - calculate F3 earned
          const earned = Math.floor(currentSequence.length / 2)
          const zoneNames = currentSequence.map(z => {
            const date = formatDateLocal(new Date(z.endDateTime))
            return `${z.localName} (${date})`
          }).join(', ')
          
          if (earned > 0) {
            sequenceDetails.push(
              `Sequence: [${zoneNames}] → ${earned} F3`
            )
          } else {
            sequenceDetails.push(
              `Sequence: [${zoneNames}] → No F3 (only ${currentSequence.length} zone${currentSequence.length > 1 ? 's' : ''} worked)`
            )
          }
          requiredF3Count += earned
          currentSequence = []
        }
      }

      // Handle final sequence if exists
      if (currentSequence.length > 0) {
        const earned = Math.floor(currentSequence.length / 2)
        const zoneNames = currentSequence.map(z => {
          const date = formatDateLocal(new Date(z.endDateTime))
          return `${z.localName} (${date})`
        }).join(', ')
        
        if (earned > 0) {
          sequenceDetails.push(
            `Sequence: [${zoneNames}] → ${earned} F3`
          )
        } else {
          sequenceDetails.push(
            `Sequence: [${zoneNames}] → No F3`
          )
        }
        requiredF3Count += earned
      }

      result.details.push('--- Sequence breakdown ---')
      sequenceDetails.forEach(line => result.details?.push(line))
      result.details.push(`Total F3 required: ${requiredF3Count}`)
      result.details.push('')

      result.details.push(`Total F3 provided: ${f3Rotations.length}`)
      result.details.push('')

      // Check 50% rule
      const totalZones = relevantTimeZones.length
      const maxAllowedWorkZones = Math.floor(totalZones / 2)
      const workedMoreThanHalf = workedZones.length > maxAllowedWorkZones

      result.details.push(`Total zones in period: ${totalZones}`)
      result.details.push(`Max allowed work zones (50%): ${maxAllowedWorkZones}`)
      result.details.push(`Zones actually worked: ${workedZones.length}`)
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
        result.details.push(`❌ Working too many zones: ${workedZones.length} > ${maxAllowedWorkZones} (max 50%)`)
        violationCount++
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Worked ${workedZones.length} zones, maximum allowed is ${maxAllowedWorkZones} (50% of ${totalZones})`
        })
      } else {
        result.details.push(`✅ Zone work within 50% limit`)
      }

      // Check if F3 properly covers the timezone (no work conflicts)
      result.details.push('')
      result.details.push('--- F3 Timezone Coverage Check ---')
      f3Rotations.forEach(f3r => {
        const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)
        const { covers, conflictDetails } = checkF3CoversTimezone(
          f3Date,
          effectiveRotations,
          basePlanShifts,
          helpingPlanStartDate,
          relevantTimeZones,
          rotations,
          shifts,
          ignoreLessThanOrEqualTo
        )
        
        const f3DateStr = formatDateLocal(f3Date)
        if (!covers) {
          result.details?.push(`❌ F3 on ${f3DateStr} does NOT fully cover timezone:`)
          conflictDetails.forEach(detail => {
            result.details?.push(`  - ${detail}`)
            violationCount++
          })
          result.violations?.push({
            weekIndex: f3r.week_index,
            dayOfWeek: f3r.day_of_week,
            description: `F3 on ${f3DateStr} doesn't cover entire timezone - work shifts still present`
          })
        } else {
          result.details?.push(`✅ F3 on ${f3DateStr} properly covers timezone`)
        }
      })

      if (violationCount > 0) {
        result.status = 'fail'
        result.message = `Annenhver: Found ${violationCount} violation(s)`
      } else if (workedZones.length === 0) {
        result.status = 'pass'
        result.message = `Annenhver: No significant zone work found (all work ≤${ignoreLessThanOrEqualTo}h)`
      } else {
        result.status = 'pass'
        result.message = `Annenhver: ${requiredF3Count} F3 required, ${f3Rotations.length} provided.`
      }

      return result
    }

    // ===================== GJENNOMSNITT (Zone-based) =====================
    if (calculationMethod === 'gjennomsnitt') {
      result.details.push('=== Gjennomsnittsberegning Analysis (Zone-based) ===')
      result.details.push('')

      const shortOverlapZones = zonesWorked.filter(zw => zw.overlapHours > 0 && zw.overlapHours < ignoreLessThanOrEqualTo)
      const significantWorkZones = zonesWorked.filter(zw => zw.overlapHours >= ignoreLessThanOrEqualTo)

      if (significantWorkZones.length === 0) {
        result.status = 'pass'
        result.message = `Gjennomsnitt: No significant zone work found (all work ≤${ignoreLessThanOrEqualTo}h)`
        if (shortOverlapZones.length > 0) {
          result.details.push(`ℹ️ All ${shortOverlapZones.length} zones have work ≤${ignoreLessThanOrEqualTo}h (ignored)`)
        }
        return result
      }

      const averageWeeksInput = (inputs.averageWeeks as number) ?? 26
      const useWeeks = plan.duration_weeks > 26 ? averageWeeksInput : plan.duration_weeks

      result.details.push(`Calculation period length: ${useWeeks} weeks`)
      result.details.push(`(Using input of ${averageWeeksInput} weeks since plan length is ${plan.duration_weeks})`)
      result.details.push('')

      const totalPeriods = Math.ceil(plan.duration_weeks / useWeeks)
      let violationCount = 0

      for (let periodIndex = 0; periodIndex < totalPeriods; periodIndex++) {
        const segmentStart = new Date(helpingPlanStartDate)
        segmentStart.setDate(segmentStart.getDate() + periodIndex * useWeeks * 7)
        const segmentEnd = new Date(segmentStart)
        segmentEnd.setDate(segmentEnd.getDate() + useWeeks * 7)

        const segmentZones = relevantTimeZones.filter(
          z => z.startDateTime >= segmentStart && z.startDateTime < segmentEnd
        )

        const totalZonesInSegment = segmentZones.length

        const workedInSegment = significantWorkZones.filter(
          zw => zw.zone.startDateTime >= segmentStart && zw.zone.startDateTime < segmentEnd
        )

        const workedZonesCount = workedInSegment.length
        const maxAllowedWorkZones = Math.floor(totalZonesInSegment / 2)
        const workedMoreThanHalf = workedZonesCount > maxAllowedWorkZones

        result.details.push(`--- Period ${periodIndex + 1} (${formatDateLocal(segmentStart)} → ${formatDateLocal(segmentEnd)}) ---`)
        result.details.push(`Total zones: ${totalZonesInSegment}`)
        result.details.push(`Worked zones: ${workedZonesCount}`)
        result.details.push(`Max allowed (50%): ${maxAllowedWorkZones}`)

        if (workedMoreThanHalf) {
          result.details.push(`❌ Worked too many zones (${workedZonesCount} > ${maxAllowedWorkZones})`)
          result.violations?.push({
            weekIndex: -1,
            dayOfWeek: -1,
            description: `Gjennomsnitt: Period ${periodIndex + 1} exceeded 50% limit (${workedZonesCount}/${totalZonesInSegment} zones)`
          })
          violationCount++
        } else {
          result.details.push(`✅ Within 50% limit (${workedZonesCount}/${totalZonesInSegment})`)
        }

        result.details.push('')
      }

      // F3 hours info (only if F3 needed)
      if (significantWorkZones.length > 0) {
        // Check if F3 properly covers timezones
        result.details.push('')
        result.details.push('--- F3 Timezone Coverage Check ---')
        f3Rotations.forEach(f3r => {
          const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)
          const { covers, conflictDetails } = checkF3CoversTimezone(
            f3Date,
            effectiveRotations,
            basePlanShifts,
            helpingPlanStartDate,
            relevantTimeZones,
            rotations,
            shifts,
            ignoreLessThanOrEqualTo
          )
          
          const f3DateStr = formatDateLocal(f3Date)
          if (!covers) {
            result.details?.push(`❌ F3 on ${f3DateStr} does NOT fully cover timezone:`)
            conflictDetails.forEach(detail => {
              result.details?.push(`  - ${detail}`)
              violationCount++
            })
            result.violations?.push({
              weekIndex: f3r.week_index,
              dayOfWeek: f3r.day_of_week,
              description: `F3 on ${f3DateStr} doesn't cover entire timezone - work shifts still present`
            })
          } else {
            result.details?.push(`✅ F3 on ${f3DateStr} properly covers timezone`)
          }
        })
      }

      if (violationCount > 0) {
        result.status = 'fail'
        result.message = `Gjennomsnitt: Found ${violationCount} violation(s)`
      } else {
        result.status = 'pass'
        result.message = `Gjennomsnitt: All ${totalPeriods} periods comply with 50% zone work limit.`
      }

      if (shortOverlapZones.length > 0) {
        result.details.push('')
        result.details.push(`ℹ️ ${shortOverlapZones.length} zones with work ≤${ignoreLessThanOrEqualTo}h ignored per agreement`)
      }

      return result
    }

    return result
  }
}

// ============================================================
// Helper Functions
// ============================================================

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
 * Check if F3 properly covers a red day timezone
 * F3 must cover the ENTIRE timezone period, not just the calendar date
 * Uses ignoreLessThanOrEqualTo to ignore minor work overlaps
 */
function checkF3CoversTimezone(
  f3Date: Date,
  rotations: Rotation[],
  shifts: Shift[],
  planStartDate: Date,
  allTimeZones: HolidayTimeZone[],
  helpingRotations: Rotation[],
  helpingShifts: Shift[],
  ignoreLessThanOrEqualTo: number
): { covers: boolean; conflictDetails: string[] } {
  
  // Find zone where the F3 date/time falls *inside* start→end, not just on end date
  const relevantZone = allTimeZones.find(zone => {
    return f3Date >= zone.startDateTime && f3Date <= zone.endDateTime
  })

  // If no matching red-day zone found → fail immediately
  if (!relevantZone) {
    return { 
      covers: false, 
      conflictDetails: [
        `F3 on ${formatDateLocal(f3Date)} is not inside any red-day timezone`
      ]
    }
  }
  
  // Check if ANY work shifts overlap with this timezone
  // BUT ignore shifts that have F3 as overlay (they're already compensated)
  // AND ignore overlaps <= ignoreLessThanOrEqualTo
  const conflictDetails: string[] = []
  
  for (const rotation of rotations) {
    if (!rotation.shift_id) continue
    
    const shift = shifts.find(s => s.id === rotation.shift_id)
    
    // Skip F3 and other default shifts - we only care about work shifts
    if (!shift || shift.is_default || !shift.start_time || !shift.end_time) continue
    
    // Check if this rotation has F3 as overlay in the helping plan
    const helpingRotation = helpingRotations.find(
      hr => hr.week_index === rotation.week_index && hr.day_of_week === rotation.day_of_week
    )
    
    if (helpingRotation?.overlay_shift_id) {
      const overlayShift = helpingShifts.find(s => s.id === helpingRotation.overlay_shift_id)
      if (overlayShift?.name === 'F3' && helpingRotation.overlay_type === 'f3_compensation') {
        // This shift has F3 overlay, so it's compensated - skip it
        continue
      }
    }
    
    const overlap = calculateTimeZoneOverlap(
      rotation,
      shift,
      relevantZone,
      planStartDate
    )
    
    // Only flag as conflict if overlap exceeds the ignore threshold
    if (overlap > ignoreLessThanOrEqualTo) {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      conflictDetails.push(
        `Week ${rotation.week_index + 1}, ${dayNames[rotation.day_of_week]}: ${shift.name} (${shift.start_time.substring(0, 5)}-${shift.end_time.substring(0, 5)}) overlaps ${overlap.toFixed(2)}h with ${relevantZone.holidayName} timezone (no F3 compensation)`
      )
    }
  }
  
  return { 
    covers: conflictDetails.length === 0, 
    conflictDetails 
  }
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