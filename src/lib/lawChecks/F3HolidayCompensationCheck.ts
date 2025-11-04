// src/lib/lawChecks/F3HolidayCompensationCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'

/**
 * Merge overlapping timezones (e.g., when a holiday falls on Sunday)
 * This prevents double-counting the same calendar day
 * Only merges zones that share the same end date AND have actual overlapping time (not just touching at boundaries)
 */
function areSameLocalDate(a: Date, b: Date): boolean {
  const ad = new Date(a)
  const bd = new Date(b)
  // Use Oslo local date by shifting to midnight in Europe/Oslo
  // (formatDateLocal returns 'YYYY-MM-DD' but numeric compare is more robust)
  const aStr = ad.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
  const bStr = bd.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
  return aStr === bStr
}

/**
 * Robust merge: merge intervals that overlap or fall on the same local calendar day.
 * Also merge when intervals are within `toleranceMs` of each other (to avoid tiny-millis edge cases).
 */
function mergeOverlappingTimeZones(zones: HolidayTimeZone[]): HolidayTimeZone[] {
  if (zones.length === 0) return []

  const sorted = [...zones].sort(
    (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
  )

  const merged: HolidayTimeZone[] = []

  for (const zone of sorted) {
    const sameDayIndex = merged.findIndex(existing =>
      // same local calendar day
      existing.startDateTime.toLocaleDateString('no-NO', { timeZone: 'Europe/Oslo' }) ===
      zone.startDateTime.toLocaleDateString('no-NO', { timeZone: 'Europe/Oslo' })
    )

    if (sameDayIndex === -1) {
      // new calendar day → push it
      merged.push({ ...zone })
      continue
    }

    // Same local day → merge: choose the longest one
    const existing = merged[sameDayIndex]
    const existingDuration = existing.endDateTime.getTime() - existing.startDateTime.getTime()
    const newDuration = zone.endDateTime.getTime() - zone.startDateTime.getTime()

    const longer = newDuration > existingDuration ? zone : existing

    merged[sameDayIndex] = {
      holidayName:
        existing.holidayName !== zone.holidayName
          ? `${existing.holidayName} + ${zone.holidayName}`
          : existing.holidayName,
      localName:
        existing.localName !== zone.localName
          ? `${existing.localName} + ${zone.localName}`
          : existing.localName,
      startDateTime: longer.startDateTime,
      endDateTime: longer.endDateTime,
      type: longer.type,
    }
  }

  // Keep chronological order
  merged.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

  return merged
}


/**
 * F3 Holiday Compensation Check (Helping Plans Only) - ZONE-BASED
 * 
 * Three calculation methods:
 * 1. Hovudregelen (Annenhver rød dag fri) - Main rule: Every other red ZONE off
 * 2. Annenhver beregning og fri fordeling - Every other ZONE with free distribution
 * 3. Gjennomsnittsberegning - Average ZONE calculation
 * 
 * NEW PLACEMENT LOGIC:
 * - F3 can be placed on a shift if it overlaps the red timezone by MORE than ignoreLessThanOrEqualTo hours
 * - Once F3 is placed, the ENTIRE timezone must be free of other work shifts
 * - Example: Shift 15:00-22:00 on Apr 1 can have F3 even if zone starts 18:00 Apr 1 (4h overlap > 1h threshold)
 * - But then NO other work is allowed in that entire timezone period
 */
export const f3HolidayCompensationCheck: LawCheck = {
  id: 'f3-holiday-compensation',
  name: 'F3 helgedags fri',
  description: 'Verifiserer at F3-vakter er korrekt plasserte. For hjelpeturnus: sjekkar mot grunnturnus og rauddagssoner. For årsturnus: sjekkar at antal F3-dagar stemmer med det som er sett når planen vart oppretta. F3 kan plasserast på skift som overlapper tidssona med meir enn grenseverdien.',
  category: 'shared',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'AML §10-10 - Søn- og helgedagsarbeid',
      url: 'https://lovdata.no/lov/2005-06-17-62/§10-10'
    }
  ],
  applicableTo: ['helping', 'year'],
  inputs: [
    {
      id: 'ignoreLessThanOrEqualTo',
      label: 'Ignorer overlapp raud tidssone lik eller under',
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

    // =====================================================
    // YEAR PLAN (STRICT) - Simple count verification
    // =====================================================
    if (plan.type === 'year' && plan.year_plan_mode === 'strict_year') {
      const f3Shift = shifts.find((s: Shift) => s.name === 'F3' && s.is_default)
      
      if (!f3Shift) {
        return {
          status: 'warning',
          message: 'F3 shift type not found',
          details: ['F3 shifts are required for holiday compensation']
        }
      }

      // Count F3 shifts in the rotation
      const f3Count = rotations.filter(r => {
        if (r.shift_id === f3Shift.id) return true
        if (r.overlay_shift_id === f3Shift.id && r.overlay_type === 'f3_compensation') return true
        return false
      }).length

      const expectedF3 = plan.f3_days || 0

      result.details = [
        'Plan type: Strict Year Plan',
        '',
        '=== F3 VERIFICATION (Preset Count) ===',
        `Expected F3 days (from plan settings): ${expectedF3}`,
        `Actual F3 shifts in rotation: ${f3Count}`,
        ''
      ]

      if (f3Count === expectedF3) {
        result.status = 'pass'
        result.message = `✅ F3 count matches preset: ${f3Count} days`
      } else if (f3Count < expectedF3) {
        result.status = 'fail'
        result.message = `❌ Missing F3 shifts: Expected ${expectedF3}, found ${f3Count}`
        result.details.push(`Manglar ${expectedF3 - f3Count} F3 plasseringar i turnus`)
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Manglar ${expectedF3 - f3Count} F3 plasseringar i turnus`
        })
      } else {
        result.status = 'warning'
        result.message = `⚠️ Extra F3 shifts: Expected ${expectedF3}, found ${f3Count}`
        result.details.push(`${f3Count - expectedF3} extra F3 shift(s) beyond preset amount`)
      }

      return result
    }

    // =====================================================
    // HELPING PLAN - Original complex logic
    // =====================================================
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

    // Merge overlapping timezones (e.g., Sunday + holiday on same day)
    const mergedTimeZones = mergeOverlappingTimeZones(relevantTimeZones)

    const zonesWorked: Array<{
      zone: HolidayTimeZone
      overlapHours: number
      rotations: Array<{ rotation: Rotation; shift: Shift; hours: number }>
    }> = []

    mergedTimeZones.forEach(zone => {
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
      `Ignore work ≤ ${ignoreLessThanOrEqualTo}h for qualification`,
      `F3 can be placed if shift overlaps timezone > ${ignoreLessThanOrEqualTo}h`,
      `Base rotation length: ${basePlanRotationLength} weeks`,
      `Helping plan period: ${plan.date_started} to ${formatDateLocal(helpingPlanEndDate)} (${plan.duration_weeks} weeks)`,
      `Week offset: ${weekOffset}`,
      `Holiday/Sunday zones worked (merged): ${zonesWorked.length}`,
      `Total hours in zones: ${zonesWorked.reduce((sum, zw) => sum + zw.overlapHours, 0).toFixed(2)}h`,
      `F3 compensation shifts: ${f3Rotations.length}`,
      ''
    ]

    // ===================== HOVUDREGELEN (Zone-based) =====================
    if (calculationMethod === 'hovedregelen') {
      result.details.push('=== Hovudregelen Analysis (Zone-based) ===\n')

      // Identify which zones were worked (>ignoreLessThanOrEqualTo hours)
      const workedZones = zonesWorked.filter(zw => zw.overlapHours > ignoreLessThanOrEqualTo)
      
      result.details.push(`Total red day zones (merged): ${mergedTimeZones.length}`)
      result.details.push(`Zones worked (>${ignoreLessThanOrEqualTo}h): ${workedZones.length}`)
      result.details.push('')

      // Track consecutive worked zones to determine F3 requirements
      const requiredF3Zones: HolidayTimeZone[] = []
      const violationDetails: string[] = []
      const workedZoneIndices = new Set(workedZones.map(zw => mergedTimeZones.indexOf(zw.zone)))

      for (let i = 0; i < mergedTimeZones.length - 1; i++) {
        const currentZone = mergedTimeZones[i]
        const nextZone = mergedTimeZones[i + 1]
        
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

      // === Check F3 placement and timezone coverage ===
      result.details.push('')
      result.details.push('--- F3 Placement & Timezone Coverage Check ---')
      let coverageViolations = 0

      f3Rotations.forEach(f3r => {
        const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)
        const f3DateStr = formatDateLocal(f3Date)

        // Check F3 placement and coverage (function will find the matching zone based on shift overlap)
        const { covers, conflictDetails } = checkF3PlacementAndCoverage(
          f3Date,
          effectiveRotations,
          basePlanShifts,
          helpingPlanStartDate,
          null, // Let function find zone by shift overlap
          rotations,
          shifts,
          ignoreLessThanOrEqualTo,
          mergedTimeZones
        )

        if (!covers) {
          result.details?.push(`❌ F3 on ${f3DateStr} has issues:`)
          conflictDetails.forEach(detail => {
            result.details?.push(`  - ${detail}`)
          })
          result.violations?.push({
            weekIndex: f3r.week_index,
            dayOfWeek: f3r.day_of_week,
            description: `F3 on ${f3DateStr}: ${conflictDetails.join('; ')}`
          })
          coverageViolations++
        } else {
          result.details?.push(`✅ F3 on ${f3DateStr} properly placed on qualifying shift and timezone is work-free`)
        }
      })

      // === Determine final result ===
      if (missingDates.length > 0 || extraDates.length > 0 || coverageViolations > 0) {
        result.status = 'fail'
        if (missingDates.length > 0) {
          result.message = `Hovudregelen: Manglar **${missingDates.length}** F3 dagar plassert i turnusen`
        } else if (extraDates.length > 0) {
          result.message = `Hovudregelen: ${extraDates.length} F3 plasseringar meir enn du har krav på`
        } else {
          result.message = `Hovudregelen: ${coverageViolations} F3 plassert på feil måte`
        }
      } else if (requiredF3Zones.length === 0) {
        result.status = 'pass'
        result.message = `Hovudregelen: Du jobbar ikkje to raude dagar på rad og har rett på 0 F3 dagar`
      } else {
        result.status = 'pass'
        result.message = `Hovudregelen: Alle F3 dagar er plassert korrekt`
      }

      return result
    }

    // ===================== ANNENHVER (Zone-based) =====================
    if (calculationMethod === 'annenhver') {
      result.details.push('=== Annenhver Beregning Analysis (Zone-based) ===\n')

      // Identify worked zones
      const workedZones = zonesWorked.filter(zw => zw.overlapHours > ignoreLessThanOrEqualTo)
      
      result.details.push(`Total red day zones (merged): ${mergedTimeZones.length}`)
      result.details.push(`Zones worked (>${ignoreLessThanOrEqualTo}h): ${workedZones.length}`)
      result.details.push('')

      // Build sequences of consecutive worked zones
      let requiredF3Count = 0
      let currentSequence: HolidayTimeZone[] = []
      const sequenceDetails: string[] = []
      const workedZoneSet = new Set(workedZones.map(zw => zw.zone))

      for (let i = 0; i < mergedTimeZones.length; i++) {
        const zone = mergedTimeZones[i]
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
      const totalZones = mergedTimeZones.length
      const maxAllowedWorkZones = Math.floor(totalZones / 2)
      const workedMoreThanHalf = workedZones.length > maxAllowedWorkZones

      result.details.push(`Total zones in period (merged): ${totalZones}`)
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

      // Check if F3 properly placed and zones are work-free
      result.details.push('')
      result.details.push('--- F3 Placement & Coverage Check ---')
      f3Rotations.forEach(f3r => {
        const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)
        const { covers, conflictDetails } = checkF3PlacementAndCoverage(
          f3Date,
          effectiveRotations,
          basePlanShifts,
          helpingPlanStartDate,
          null, // will find zone inside function
          rotations,
          shifts,
          ignoreLessThanOrEqualTo,
          mergedTimeZones
        )
        
        const f3DateStr = formatDateLocal(f3Date)
        if (!covers) {
          result.details?.push(`❌ F3 on ${f3DateStr} has issues:`)
          conflictDetails.forEach(detail => {
            result.details?.push(`  - ${detail}`)
            violationCount++
          })
          result.violations?.push({
            weekIndex: f3r.week_index,
            dayOfWeek: f3r.day_of_week,
            description: `F3 on ${f3DateStr}: ${conflictDetails.join('; ')}`
          })
        } else {
          result.details?.push(`✅ F3 on ${f3DateStr} properly placed`)
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

        const segmentZones = mergedTimeZones.filter(
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

      // Check F3 placement
      if (significantWorkZones.length > 0) {
        result.details.push('')
        result.details.push('--- F3 Placement & Coverage Check ---')
        f3Rotations.forEach(f3r => {
          const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)
          const { covers, conflictDetails } = checkF3PlacementAndCoverage(
            f3Date,
            effectiveRotations,
            basePlanShifts,
            helpingPlanStartDate,
            null,
            rotations,
            shifts,
            ignoreLessThanOrEqualTo,
            mergedTimeZones
          )
          
          const f3DateStr = formatDateLocal(f3Date)
          if (!covers) {
            result.details?.push(`❌ F3 on ${f3DateStr} has issues:`)
            conflictDetails.forEach(detail => {
              result.details?.push(`  - ${detail}`)
              violationCount++
            })
            result.violations?.push({
              weekIndex: f3r.week_index,
              dayOfWeek: f3r.day_of_week,
              description: `F3 on ${f3DateStr}: ${conflictDetails.join('; ')}`
            })
          } else {
            result.details?.push(`✅ F3 on ${f3DateStr} properly placed`)
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
 * NEW: Check if F3 is properly placed and timezone is work-free
 * 
 * Rules:
 * 1. F3 must be on a shift that overlaps the timezone by > ignoreLessThanOrEqualTo
 * 2. The entire timezone must be free of OTHER work (excluding the F3 shift itself)
 */
function checkF3PlacementAndCoverage(
  f3Date: Date,
  baseRotations: Rotation[],
  baseShifts: Shift[],
  planStartDate: Date,
  specifiedZone: HolidayTimeZone | null,
  helpingRotations: Rotation[],
  helpingShifts: Shift[],
  ignoreLessThanOrEqualTo: number,
  allTimeZones?: HolidayTimeZone[]
): { covers: boolean; conflictDetails: string[] } {
  
  console.log('\n🔎 checkF3PlacementAndCoverage called:')
  console.log(`  F3 Date: ${formatDateLocal(f3Date)}`)
  console.log(`  Specified zone: ${specifiedZone ? specifiedZone.localName : 'null (will search)'}`)
  console.log(`  Ignore threshold: ${ignoreLessThanOrEqualTo}h`)
  
  // Find the helping rotation that has the F3 overlay
  const f3HelpingRotation = helpingRotations.find(hr => {
    const hrDate = getRotationDate(planStartDate, hr.week_index, hr.day_of_week)
    return formatDateLocal(hrDate) === formatDateLocal(f3Date) && 
           hr.overlay_type === 'f3_compensation'
  })
  
  if (!f3HelpingRotation) {
    console.log('  ❌ No helping rotation found')
    return {
      covers: false,
      conflictDetails: [`F3 on ${formatDateLocal(f3Date)} has no corresponding helping rotation`]
    }
  }
  
  console.log(`  ✅ Found helping rotation: Week ${f3HelpingRotation.week_index}, Day ${f3HelpingRotation.day_of_week}`)
  
  // PHASE 2: Use HELPING PLAN shift to check F3 placement
  // Find the actual shift in the helping plan where F3 is placed
  const helpingShiftWithF3 = helpingShifts.find(s => s.id === f3HelpingRotation.shift_id)
  
  if (!helpingShiftWithF3 || !helpingShiftWithF3.start_time || !helpingShiftWithF3.end_time) {
    console.log('  ❌ Helping shift has no time info')
    return {
      covers: false,
      conflictDetails: [`F3 on ${formatDateLocal(f3Date)} is on a shift without time info`]
    }
  }
  
  console.log(`  ✅ Helping plan shift (where F3 is placed): ${helpingShiftWithF3.name} (${helpingShiftWithF3.start_time.substring(0,5)}-${helpingShiftWithF3.end_time.substring(0,5)})`)
  
  // Find zone by checking which timezone the F3 SHIFT (from helping plan) overlaps with
  // This is important because a shift on April 1st might overlap with a timezone that starts at 18:00 on April 1st
  // IMPORTANT: Only accept a zone if the overlap is > ignoreLessThanOrEqualTo
  let relevantZone = specifiedZone
  let maxOverlap = 0
  
  if (!relevantZone && allTimeZones) {
    console.log(`  🔍 Searching for matching timezone among ${allTimeZones.length} zones...`)
    // Find the timezone that this shift overlaps with the most (and that exceeds threshold)
    for (const zone of allTimeZones) {
      const overlap = calculateTimeZoneOverlap(
        f3HelpingRotation, // Use helping rotation position
        helpingShiftWithF3, // Use helping plan shift times
        zone,
        planStartDate,
        false // Disable detailed logging - we'll log summary below
      )
      console.log(`    Checking zone: ${zone.localName} (${formatDateLocal(zone.endDateTime)}) - overlap: ${overlap.toFixed(2)}h`)
      // Only consider this zone if overlap exceeds the threshold
      if (overlap > ignoreLessThanOrEqualTo && overlap > maxOverlap) {
        console.log(`      ✅ New best match! (${overlap.toFixed(2)}h > ${ignoreLessThanOrEqualTo}h threshold)`)
        maxOverlap = overlap
        relevantZone = zone
      } else if (overlap > 0 && overlap <= ignoreLessThanOrEqualTo) {
        console.log(`      ⚠️ Overlap too small (${overlap.toFixed(2)}h ≤ ${ignoreLessThanOrEqualTo}h threshold)`)
      }
    }
    
    // Log detailed calculation for the selected zone only
    if (relevantZone) {
      console.log(`\n  📊 DETAILED CALCULATION for selected zone:`)
      calculateTimeZoneOverlap(
        f3HelpingRotation,
        helpingShiftWithF3,
        relevantZone,
        planStartDate,
        true // Enable detailed logging for selected zone
      )
    }
  }

  if (!relevantZone) {
    console.log('  ❌ No matching timezone found')
    return { 
      covers: false, 
      conflictDetails: [
        `F3 on ${formatDateLocal(f3Date)} (shift ${helpingShiftWithF3.start_time.substring(0, 5)}-${helpingShiftWithF3.end_time.substring(0, 5)}) does not overlap with any red-day timezone by more than ${ignoreLessThanOrEqualTo}h`
      ]
    }
  }
  
  console.log(`  ✅ Selected zone: ${relevantZone.localName} with ${maxOverlap.toFixed(2)}h overlap`)
  
  // RULE 1: Already validated above - helping plan shift overlaps timezone by > threshold
  
  // RULE 2: Check that the entire timezone is free of OTHER work in BASE PLAN (excluding the F3 position)
  const conflictDetails: string[] = []
  
  for (const rotation of baseRotations) {
    if (!rotation.shift_id) continue
    
    // Skip the rotation position that has F3 on it in helping plan
    if (rotation.week_index === f3HelpingRotation.week_index && 
        rotation.day_of_week === f3HelpingRotation.day_of_week) {
      continue
    }
    
    const shift = baseShifts.find(s => s.id === rotation.shift_id)
    
    // Skip default shifts - we only care about work shifts
    if (!shift || shift.is_default || !shift.start_time || !shift.end_time) continue
    
    // Check if this rotation also has F3 overlay (another F3 in same zone - that's ok)
    const otherHelpingRotation = helpingRotations.find(
      hr => hr.week_index === rotation.week_index && hr.day_of_week === rotation.day_of_week
    )
    
    if (otherHelpingRotation?.overlay_shift_id) {
      const overlayShift = helpingShifts.find(s => s.id === otherHelpingRotation.overlay_shift_id)
      if (overlayShift?.name === 'F3' && otherHelpingRotation.overlay_type === 'f3_compensation') {
        // This is another F3 shift - skip it
        continue
      }
    }
    
    const overlap = calculateTimeZoneOverlap(
      rotation,
      shift,
      relevantZone,
      planStartDate,
      false
    )
    
    // Flag as conflict if ANY work exists in the timezone
    // Once F3 is placed, the entire zone must be work-free
    if (overlap > 0) {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      conflictDetails.push(
        `Week ${rotation.week_index + 1}, ${dayNames[rotation.day_of_week]}: ${shift.name} (${shift.start_time.substring(0, 5)}-${shift.end_time.substring(0, 5)}) overlaps ${overlap.toFixed(2)}h with ${relevantZone.localName} timezone (work not allowed in F3 zone)`
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
  planStartDate: Date,
  shouldLog: boolean = false
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

  const overlapMillis = overlapEnd.getTime() - overlapStart.getTime()
  const overlapHours = overlapMillis / (1000 * 60 * 60)

  // Log the calculation only if requested
  if (shouldLog) {
    console.log('\n🔍 calculateTimeZoneOverlap:')
    console.log(`  Rotation: Week ${rotation.week_index}, Day ${rotation.day_of_week}`)
    console.log(`  Shift: ${shift.name} (${shift.start_time.substring(0,5)}-${shift.end_time.substring(0,5)})`)
    console.log(`  Is night shift: ${isNightShift}`)
    console.log(`  Shift period: ${shiftStartDateTime.toLocaleString('no-NO')} → ${shiftEndDateTime.toLocaleString('no-NO')}`)
    console.log(`  Zone: ${zone.startDateTime.toLocaleString('no-NO')} → ${zone.endDateTime.toLocaleString('no-NO')}`)
    console.log(`  Overlap start: ${overlapStart.toLocaleString('no-NO')}`)
    console.log(`  Overlap end: ${overlapEnd.toLocaleString('no-NO')}`)
    console.log(`  Overlap hours: ${overlapHours.toFixed(2)}h`)
  }

  if (overlapStart < overlapEnd) {
    return overlapHours
  }

  if (shouldLog) {
    console.log(`  ⚠️ No overlap (overlapStart >= overlapEnd)`)
  }
  return 0
}