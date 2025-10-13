// src/lib/lawChecks/F3HolidayCompensationCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'

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
  description: 'Verifies F3 shifts are properly placed after work on holidays. Choose calculation method based on your agreement.',
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

    // Get calculation method and ignore threshold from inputs
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

    // Only applies to helping plans
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

    if (!basePlanRotations || !basePlanShifts) {
      return {
        status: 'warning',
        message: 'Base plan data not available',
        details: ['Cannot analyze F3 compensation without base plan data']
      }
    }

    // Find F3 shift
    const f3Shift = shifts.find((s: Shift) => s.name === 'F3' && s.is_default)
    
    if (!f3Shift) {
      return {
        status: 'warning',
        message: 'F3 shift type not found in helping plan',
        details: ['F3 shifts are required for holiday compensation']
      }
    }

    // Calculate base plan rotation length
    const maxWeek = Math.max(...basePlanRotations.map(r => r.week_index))
    const basePlanRotationLength = maxWeek + 1
    
    // Calculate week offset
    let weekOffset = 0
    
    if (basePlan) {
      const basePlanStartDate = new Date(basePlan.date_started)
      const helpingPlanStartDate = new Date(plan.date_started)
      
      const diffTime = helpingPlanStartDate.getTime() - basePlanStartDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      const diffWeeks = Math.floor(diffDays / 7)
      
      weekOffset = diffWeeks % basePlanRotationLength
      if (weekOffset < 0) {
        weekOffset += basePlanRotationLength
      }
    }
    
    const helpingPlanStartDate = new Date(plan.date_started)
    const helpingPlanEndDate = new Date(helpingPlanStartDate)
    helpingPlanEndDate.setDate(helpingPlanEndDate.getDate() + (plan.duration_weeks * 7))

    // Create effective rotations
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

    // Get holiday time zones
    const startYear = helpingPlanStartDate.getFullYear()
    const endYear = helpingPlanEndDate.getFullYear()
    
    const allTimeZones: HolidayTimeZone[] = []
    for (let year = startYear; year <= endYear; year++) {
      allTimeZones.push(...getHolidayTimeZones(year))
    }
    
    const sundayZones = createSundayTimeZones(helpingPlanStartDate, helpingPlanEndDate)
    allTimeZones.push(...sundayZones)
    
    const relevantTimeZones = allTimeZones.filter(zone => {
      return zone.startDateTime < helpingPlanEndDate && zone.endDateTime > helpingPlanStartDate
    })
    
    relevantTimeZones.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

    // Analyze work in holiday zones
    const zonesWorked: Array<{
      zone: typeof relevantTimeZones[0]
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

        const overlapHours = calculateTimeZoneOverlap(
          rotation,
          shift,
          zone,
          helpingPlanStartDate
        )

        if (overlapHours > 0) {
          totalOverlapHours += overlapHours
          rotationsInZone.push({ rotation, shift, hours: overlapHours })
        }
      })

      if (totalOverlapHours > 0) {
        zonesWorked.push({
          zone,
          overlapHours: totalOverlapHours,
          rotations: rotationsInZone
        })
      }
    })

    // Find F3 rotations in helping plan
    const f3Rotations = rotations.filter((r: Rotation) => {
      const shift = shifts.find((s: Shift) => s.id === r.shift_id)
      return shift?.name === 'F3'
    })

    // Build initial details
    result.details = [
      `Ignore work ≤ ${ignoreLessThanOrEqualTo}h`,
      `Base rotation length: ${basePlanRotationLength} weeks`,
      `Helping plan period: ${plan.date_started} to ${formatDateLocal(helpingPlanEndDate)} (${plan.duration_weeks} weeks)`,
      `Week offset: ${weekOffset}`,
      `Holiday/Sunday zones worked: ${zonesWorked.length}`,
      `Total hours in zones: ${zonesWorked.reduce((sum, zw) => sum + zw.overlapHours, 0).toFixed(2)}h`,
      `F3 compensation shifts: ${f3Rotations.length}`,
      ''
    ]

    // HOVUDREGELEN (Annenhver rød dag fri)
    if (calculationMethod === 'hovedregelen') {
      result.details.push('=== Hovudregelen Analysis ===')
      result.details.push('')

      // Group zones worked by main red day date
      const redDaysWorked: Map<string, {
        mainDate: Date
        zones: typeof zonesWorked
        f3Placed: boolean
        hasWorkInZone: boolean
      }> = new Map()

      // Process each worked zone
      zonesWorked.forEach(zw => {
        let mainDate: Date
        
        if (zw.zone.localName === 'Søndag') {
          const zoneEndDate = new Date(zw.zone.endDateTime)
          mainDate = new Date(
            zoneEndDate.getFullYear(),
            zoneEndDate.getMonth(),
            zoneEndDate.getDate(),
            0, 0, 0, 0
          )
          
          if (mainDate.getDay() !== 0) {
            console.error(`ERROR: Sunday zone date ${formatDateLocal(mainDate)} is not a Sunday (day ${mainDate.getDay()})`)
            result.details?.push(`WARNING: Sunday zone has incorrect date - expected Sunday but got day ${mainDate.getDay()}`)
          }
        } else {
          const zoneEndDate = new Date(zw.zone.endDateTime)
          mainDate = new Date(
            zoneEndDate.getFullYear(),
            zoneEndDate.getMonth(),
            zoneEndDate.getDate(),
            0, 0, 0, 0
          )
        }
        
        const dateKey = formatDateLocal(mainDate)
        
        if (!redDaysWorked.has(dateKey)) {
          redDaysWorked.set(dateKey, {
            mainDate,
            zones: [],
            f3Placed: false,
            hasWorkInZone: true
          })
        }
        
        const entry = redDaysWorked.get(dateKey)!
        entry.zones.push(zw)
      })

      // Check F3 placements
      f3Rotations.forEach(f3r => {
        const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)
        const f3DateKey = formatDateLocal(f3Date)
        
        if (redDaysWorked.has(f3DateKey)) {
          const entry = redDaysWorked.get(f3DateKey)!
          entry.f3Placed = true
        }
      })

      const redDaysList = Array.from(redDaysWorked.entries()).sort((a, b) => 
        a[1].mainDate.getTime() - b[1].mainDate.getTime()
      )

      // Filter significant work (> ignoreLessThanOrEqualTo threshold)
      const significantRedDays = redDaysList.filter(([_, data]) => 
        data.zones.some(z => z.overlapHours > ignoreLessThanOrEqualTo)
      )

      result.details?.push(`Red days with significant work (>${ignoreLessThanOrEqualTo}h): ${significantRedDays.length}`)
      
      let violationCount = 0
      
      // Under hovudregelen: every OTHER red day should have F3
      significantRedDays.forEach(([dateKey, data], index) => {
        const shouldHaveF3 = (index + 1) % 2 === 0
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const dayName = dayNames[data.mainDate.getDay()]
        const totalHours = data.zones.reduce((sum, z) => sum + z.overlapHours, 0)
        
        result.details?.push(`${index + 1}. ${dateKey} (${dayName}): ${totalHours.toFixed(2)}h worked`)
        
        if (shouldHaveF3) {
          if (!data.f3Placed) {
            result.details?.push(`   ❌ F3 MISSING (should be placed on this day)`)
            violationCount++
            
            result.violations?.push({
              weekIndex: -1,
              dayOfWeek: -1,
              description: `F3 missing on ${dateKey} - every 2nd red day should have F3`
            })
          } else {
            const hasWorkConflict = checkF3WorkConflict(
              data.mainDate,
              rotations,
              shifts,
              helpingPlanStartDate,
              relevantTimeZones
            )
            
            if (hasWorkConflict) {
              result.details?.push(`   ⚠️ F3 placed but work found in timezone`)
              violationCount++
              
              result.violations?.push({
                weekIndex: -1,
                dayOfWeek: -1,
                description: `F3 on ${dateKey} has work conflict - no shifts allowed in F3 timezone`
              })
            } else {
              result.details?.push(`   ✅ F3 correctly placed with no work in zone`)
            }
          }
        } else {
          result.details?.push(`   (No F3 expected - odd numbered red day)`)
        }
      })

      // Set final status
      if (violationCount > 0) {
        result.status = 'fail'
        result.message = `Hovudregelen: Found ${violationCount} violation(s)`
      } else if (significantRedDays.length === 0) {
        result.status = 'pass'
        result.message = `Hovudregelen: No significant red day work found (all work ≤${ignoreLessThanOrEqualTo}h)`
      } else {
        result.status = 'pass'
        result.message = `Hovudregelen: All F3 placements correct`
      }
    }
    // ANNENHVER BEREGNING OG FRI FORDELING
    else if (calculationMethod === 'annenhver') {
      result.details.push('=== Annenhver Beregning Analysis ===')
      result.details.push('')

      // Filter significant work zones
      const significantWorkZones = zonesWorked.filter(zw => zw.overlapHours > ignoreLessThanOrEqualTo)
      const shortOverlapZones = zonesWorked.filter(zw => zw.overlapHours <= ignoreLessThanOrEqualTo)
      
      if (significantWorkZones.length === 0) {
        result.status = 'pass'
        result.message = `Annenhver: No significant red day work found (all work ≤${ignoreLessThanOrEqualTo}h)`
        if (shortOverlapZones.length > 0) {
          result.details?.push(`ℹ️ All ${shortOverlapZones.length} zones have work ≤${ignoreLessThanOrEqualTo}h (ignored)`)
        }
        return result
      }

      // Get all significant red day dates
      const significantRedDayDates = new Set<string>()
      significantWorkZones.forEach(zw => {
        let mainDate: Date
        if (zw.zone.localName === 'Søndag') {
          const zoneEndDate = new Date(zw.zone.endDateTime)
          mainDate = new Date(zoneEndDate.getFullYear(), zoneEndDate.getMonth(), zoneEndDate.getDate(), 0, 0, 0, 0)
        } else {
          const zoneEndDate = new Date(zw.zone.endDateTime)
          mainDate = new Date(zoneEndDate.getFullYear(), zoneEndDate.getMonth(), zoneEndDate.getDate(), 0, 0, 0, 0)
        }
        significantRedDayDates.add(formatDateLocal(mainDate))
      })

      const sortedRedDayDates = Array.from(significantRedDayDates).sort()
      
      result.details?.push(`Red days worked (>${ignoreLessThanOrEqualTo}h): ${sortedRedDayDates.length}`)
      result.details?.push('')

      // Count consecutive sequences and calculate required F3
      let requiredF3Count = 0
      let currentSequence = 0
      let sequences: Array<{ start: string; end: string; count: number; f3Required: number }> = []
      
      for (let i = 0; i < sortedRedDayDates.length; i++) {
        const currentDate = new Date(sortedRedDayDates[i])
        
        if (i === 0) {
          currentSequence = 1
        } else {
          const prevDate = new Date(sortedRedDayDates[i - 1])
          const daysDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
          
          // Check if consecutive (allowing for the next Sunday or next holiday)
          if (daysDiff <= 7) {
            currentSequence++
          } else {
            // End of sequence - calculate F3 required
            const f3ForSequence = Math.floor(currentSequence / 2)
            requiredF3Count += f3ForSequence
            
            sequences.push({
              start: sortedRedDayDates[i - currentSequence],
              end: sortedRedDayDates[i - 1],
              count: currentSequence,
              f3Required: f3ForSequence
            })
            
            currentSequence = 1
          }
        }
      }
      
      // Handle last sequence
      if (currentSequence > 0) {
        const f3ForSequence = Math.floor(currentSequence / 2)
        requiredF3Count += f3ForSequence
        
        sequences.push({
          start: sortedRedDayDates[sortedRedDayDates.length - currentSequence],
          end: sortedRedDayDates[sortedRedDayDates.length - 1],
          count: currentSequence,
          f3Required: f3ForSequence
        })
      }

      // Display sequences
      result.details?.push('Consecutive sequences:')
      sequences.forEach((seq, idx) => {
        result.details?.push(`  ${idx + 1}. ${seq.start} to ${seq.end}: ${seq.count} day${seq.count > 1 ? 's' : ''} → ${seq.f3Required} F3 required`)
      })
      result.details?.push('')

      // Check F3 count
      result.details?.push(`Total F3 required: ${requiredF3Count}`)
      result.details?.push(`Total F3 provided: ${f3Rotations.length}`)
      result.details?.push('')

      // Check max work constraint (can't work more than half of red days)
      const totalRedDaysInPeriod = relevantTimeZones.length
      const maxAllowedWorkDays = Math.floor(totalRedDaysInPeriod / 2)
      const workedMoreThanHalf = sortedRedDayDates.length > maxAllowedWorkDays

      result.details?.push(`Total red days in period: ${totalRedDaysInPeriod}`)
      result.details?.push(`Max allowed work days (50%): ${maxAllowedWorkDays}`)
      result.details?.push(`Days actually worked: ${sortedRedDayDates.length}`)
      result.details?.push('')

      let violationCount = 0
      
      if (f3Rotations.length < requiredF3Count) {
        result.details?.push(`❌ Insufficient F3: Need ${requiredF3Count}, have ${f3Rotations.length}`)
        violationCount++
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Need ${requiredF3Count} F3 shifts but only ${f3Rotations.length} provided`
        })
      } else if (f3Rotations.length > requiredF3Count) {
        result.details?.push(`ℹ️ Extra F3: Have ${f3Rotations.length - requiredF3Count} more than required`)
      } else {
        result.details?.push(`✅ F3 count matches requirement`)
      }

      if (workedMoreThanHalf) {
        result.details?.push(`❌ Working too many red days: ${sortedRedDayDates.length} > ${maxAllowedWorkDays} (max 50%)`)
        violationCount++
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Worked ${sortedRedDayDates.length} red days, maximum allowed is ${maxAllowedWorkDays} (50% of ${totalRedDaysInPeriod})`
        })
      } else {
        result.details?.push(`✅ Red day work within 50% limit`)
      }

      // Set final status
      if (violationCount > 0) {
        result.status = 'fail'
        result.message = `Annenhver: Found ${violationCount} violation(s)`
      } else {
        result.status = 'pass'
        result.message = `Annenhver: ${requiredF3Count} F3 required, ${f3Rotations.length} provided. All constraints met.`
      }

      if (shortOverlapZones.length > 0) {
        result.details?.push('')
        result.details?.push(`ℹ️ ${shortOverlapZones.length} zones with work ≤${ignoreLessThanOrEqualTo}h ignored per agreement`)
      }
    }
    // GJENNOMSNITT
    else if (calculationMethod === 'gjennomsnitt') {
      result.details.push('=== Gjennomsnittsberegning Analysis ===')
      result.details.push('')
      
      const shortOverlapZones = zonesWorked.filter(zw => zw.overlapHours <= ignoreLessThanOrEqualTo)
      const significantWorkZones = zonesWorked.filter(zw => zw.overlapHours > ignoreLessThanOrEqualTo)
      
      if (significantWorkZones.length === 0) {
        result.status = 'pass'
        result.message = `Gjennomsnitt: No significant red day work found (all work ≤${ignoreLessThanOrEqualTo}h)`
        if (shortOverlapZones.length > 0) {
          result.details?.push(`ℹ️ All ${shortOverlapZones.length} zones have work ≤${ignoreLessThanOrEqualTo}h (ignored)`)
        }
        return result
      }

      // Get all significant red day dates
      const significantRedDayDates = new Set<string>()
      significantWorkZones.forEach(zw => {
        let mainDate: Date
        if (zw.zone.localName === 'Søndag') {
          const zoneEndDate = new Date(zw.zone.endDateTime)
          mainDate = new Date(zoneEndDate.getFullYear(), zoneEndDate.getMonth(), zoneEndDate.getDate(), 0, 0, 0, 0)
        } else {
          const zoneEndDate = new Date(zw.zone.endDateTime)
          mainDate = new Date(zoneEndDate.getFullYear(), zoneEndDate.getMonth(), zoneEndDate.getDate(), 0, 0, 0, 0)
        }
        significantRedDayDates.add(formatDateLocal(mainDate))
      })

      const sortedRedDayDates = Array.from(significantRedDayDates).sort()
      
      // Check max work constraint (can't work more than half of red days)
      const totalRedDaysInPeriod = relevantTimeZones.length
      const maxAllowedWorkDays = Math.floor(totalRedDaysInPeriod / 2)
      const workedMoreThanHalf = sortedRedDayDates.length > maxAllowedWorkDays

      result.details?.push(`Total red days in period: ${totalRedDaysInPeriod}`)
      result.details?.push(`Max allowed work days (50%, rounded down): ${maxAllowedWorkDays}`)
      result.details?.push(`Days actually worked (>${ignoreLessThanOrEqualTo}h): ${sortedRedDayDates.length}`)
      result.details?.push('')

      if (workedMoreThanHalf) {
        result.status = 'fail'
        result.message = `Gjennomsnitt: Working too many red days - ${sortedRedDayDates.length} > ${maxAllowedWorkDays} (max 50%)`
        result.details?.push(`❌ Worked ${sortedRedDayDates.length} red days, maximum allowed is ${maxAllowedWorkDays}`)
        result.violations?.push({
          weekIndex: -1,
          dayOfWeek: -1,
          description: `Worked ${sortedRedDayDates.length} red days, maximum allowed is ${maxAllowedWorkDays} (50% of ${totalRedDaysInPeriod}, rounded down)`
        })
      } else {
        result.status = 'pass'
        result.message = `Gjennomsnitt: ${sortedRedDayDates.length} of ${totalRedDaysInPeriod} red days worked (within 50% limit)`
        result.details?.push(`✅ Red day work within 50% limit (${sortedRedDayDates.length}/${maxAllowedWorkDays} days used)`)
      }

      if (shortOverlapZones.length > 0) {
        result.details?.push('')
        result.details?.push(`ℹ️ ${shortOverlapZones.length} zones with work ≤${ignoreLessThanOrEqualTo}h ignored per agreement`)
      }
    }

    return result
  }
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