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
  inputs: [],
  
  run: ({ rotations, shifts, plan, basePlanRotations, basePlanShifts, basePlan, inputs = {} }) => {
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

    // Get calculation method from inputs
    const calculationMethod = (inputs.calculationMethod as string) || 'hovedregelen'
    
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

    // Find F3 rotations
    const f3Rotations = rotations.filter((r: Rotation) => {
      const shift = shifts.find((s: Shift) => s.id === r.shift_id)
      return shift?.name === 'F3'
    })

    // Build initial details
    result.details = [
      `Calculation Method: ${methodName}`,
      `Base rotation length: ${basePlanRotationLength} weeks`,
      `Helping plan period: ${plan.date_started} to ${helpingPlanEndDate.toISOString().split('T')[0]} (${plan.duration_weeks} weeks)`,
      `Week offset: ${weekOffset}`,
      `Holiday/Sunday zones worked: ${zonesWorked.length}`,
      `Total hours in zones: ${zonesWorked.reduce((sum, zw) => sum + zw.overlapHours, 0).toFixed(2)}h`,
      `F3 compensation shifts: ${f3Rotations.length}`,
      ''
    ]

    // HOVUDREGELEN (Annenhver rød dag fri) - NEW IMPLEMENTATION
    if (calculationMethod === 'hovedregelen') {
      // Split analysis by 26-week periods if plan is longer
      const periodsToAnalyze: Array<{
        startWeek: number
        endWeek: number
        name: string
      }> = []

      if (plan.duration_weeks > 26) {
        // Split into 26-week chunks
        let currentWeek = 0
        let periodNum = 1
        
        while (currentWeek < plan.duration_weeks) {
          const remainingWeeks = plan.duration_weeks - currentWeek
          const periodLength = Math.min(26, remainingWeeks)
          
          periodsToAnalyze.push({
            startWeek: currentWeek,
            endWeek: currentWeek + periodLength - 1,
            name: `Period ${periodNum} (Weeks ${currentWeek + 1}-${currentWeek + periodLength})`
          })
          
          currentWeek += periodLength
          periodNum++
        }
      } else {
        // Single period for plans <= 26 weeks
        periodsToAnalyze.push({
          startWeek: 0,
          endWeek: plan.duration_weeks - 1,
          name: `Full Plan (Weeks 1-${plan.duration_weeks})`
        })
      }

      result.details.push('=== Hovudregelen Analysis ===')
      result.details.push('')

      let totalViolations = 0

      // Analyze each period
      periodsToAnalyze.forEach(period => {
        result.details?.push(`--- ${period.name} ---`)
        
        // Get zones worked in this period
        const periodZonesWorked = zonesWorked.filter(zw => {
          // Find which week this zone falls in
          const zoneWeek = Math.floor(
            (zw.zone.startDateTime.getTime() - helpingPlanStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
          )
          return zoneWeek >= period.startWeek && zoneWeek <= period.endWeek
        })

        // Get F3 rotations in this period
        const periodF3Rotations = f3Rotations.filter(
          f3r => f3r.week_index >= period.startWeek && f3r.week_index <= period.endWeek
        )

        // Filter out short overlaps (< 1 hour)
        const significantZones = periodZonesWorked.filter(zw => zw.overlapHours >= 1)
        const shortZones = periodZonesWorked.filter(zw => zw.overlapHours < 1)

        result.details?.push(`  Red days worked: ${significantZones.length} (${shortZones.length} < 1h)`)
        result.details?.push(`  F3 shifts placed: ${periodF3Rotations.length}`)

        // Hovudregelen: every OTHER red day should have F3
        // So if you work 4 red days, you should have 2 F3s
        const expectedF3 = Math.ceil(significantZones.length / 2)
        
        result.details?.push(`  Expected F3 (every 2nd red day): ${expectedF3}`)

        // Check compliance
        if (significantZones.length > 0 && periodF3Rotations.length === 0) {
          result.details?.push(`  ❌ VIOLATION: Worked ${significantZones.length} red day(s) but NO F3 compensation`)
          totalViolations++
          
          result.violations?.push({
            weekIndex: period.startWeek,
            dayOfWeek: -1,
            description: `${period.name}: Worked ${significantZones.length} red day(s) but no F3 compensation`
          })
        } else if (periodF3Rotations.length < expectedF3) {
          result.details?.push(`  ⚠️ WARNING: Expected ${expectedF3} F3 shifts, but only ${periodF3Rotations.length} placed`)
          totalViolations++
          
          result.violations?.push({
            weekIndex: period.startWeek,
            dayOfWeek: -1,
            description: `${period.name}: Expected ${expectedF3} F3 shifts, found ${periodF3Rotations.length}`
          })
        } else if (shortZones.length > 0) {
          result.details?.push(`  ⚠️ NOTE: ${shortZones.length} zone(s) < 1h (may be negotiated away)`)
        } else {
          result.details?.push(`  ✅ COMPLIANT`)
        }

        // List worked zones with sequential numbering
        if (significantZones.length > 0) {
          result.details?.push(`  Zones worked (≥1h):`)
          significantZones.forEach((zw, idx) => {
            const shouldHaveF3 = (idx + 1) % 2 === 0 // Every 2nd zone
            const marker = shouldHaveF3 ? '→ F3 expected' : ''
            result.details?.push(
              `    ${idx + 1}. ${zw.zone.localName}: ${zw.overlapHours.toFixed(2)}h ${marker}`
            )
          })
        }

        if (periodF3Rotations.length > 0) {
          result.details?.push(`  F3 shifts placed:`)
          periodF3Rotations.forEach(f3r => {
            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            result.details?.push(`    Week ${f3r.week_index + 1}, ${dayNames[f3r.day_of_week]}`)
          })
        }

        result.details?.push('')
      })

      // Set final status
      if (totalViolations > 0) {
        result.status = 'fail'
        result.message = `Hovudregelen: Found ${totalViolations} violation(s) across ${periodsToAnalyze.length} period(s)`
      } else {
        result.status = 'pass'
        result.message = `Hovudregelen: All periods compliant with every-other-red-day rule`
      }
    }
    // OTHER METHODS - Keep existing implementation for now
    else if (calculationMethod === 'annenhver') {
      const shortOverlapZones = zonesWorked.filter(zw => zw.overlapHours < 1)
      const significantWorkZones = zonesWorked.filter(zw => zw.overlapHours >= 1)
      
      if (significantWorkZones.length > 0 && f3Rotations.length === 0) {
        result.status = 'fail'
        result.message = `Annenhver: ${significantWorkZones.length} zone(s) worked but NO F3 compensation.`
      } else if (shortOverlapZones.length > 0) {
        result.status = 'warning'
        result.message = `Annenhver: ${zonesWorked.length} zones (${shortOverlapZones.length} <1h), ${f3Rotations.length} F3 shift(s).`
        result.details?.push('')
        result.details?.push('⚠️ Nokre arbeidsgjevarar og tillitsvalgte har avtalt seg vekk frå korte overlappingar inn i helgedagstidssonar mot andre goder. Sjekk med din tillitsvalgte.')
      } else {
        result.status = 'pass'
        result.message = `Annenhver: ${zonesWorked.length} zones worked, ${f3Rotations.length} F3 shift(s). Review distribution.`
      }
    } else if (calculationMethod === 'gjennomsnitt') {
      const totalHoursWorked = zonesWorked.reduce((sum, zw) => sum + zw.overlapHours, 0)
      const avgHoursPerZone = totalHoursWorked / Math.max(zonesWorked.length, 1)
      const shortOverlapZones = zonesWorked.filter(zw => zw.overlapHours < 1)
      const significantWorkZones = zonesWorked.filter(zw => zw.overlapHours >= 1)
      
      if (significantWorkZones.length > 0 && f3Rotations.length === 0) {
        result.status = 'fail'
        result.message = `Gjennomsnitt: ${significantWorkZones.length} zone(s) worked but NO F3 compensation.`
      } else if (shortOverlapZones.length > 0) {
        result.status = 'warning'
        result.message = `Gjennomsnitt: ${zonesWorked.length} zones, avg ${avgHoursPerZone.toFixed(1)}h/zone, ${f3Rotations.length} F3 shift(s).`
        result.details?.push('')
        result.details?.push('⚠️ Nokre arbeidsgjevarar og tillitsvaldte har avtalt seg vekk frå korte overlappingar inn i helgedagstidssonar mot andre goder. Sjekk med din tillitsvalgte.')
      } else {
        result.status = 'pass'
        result.message = `Gjennomsnitt: ${zonesWorked.length} zones, avg ${avgHoursPerZone.toFixed(1)}h/zone, ${f3Rotations.length} F3 shift(s).`
      }
    }

    return result
  }
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

  const rotationDate = new Date(planStartDate)
  const daysToAdd = (rotation.week_index * 7) + rotation.day_of_week
  rotationDate.setDate(rotationDate.getDate() + daysToAdd)

  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  if (rotation.day_of_week === 0 && isNightShift) {
    const sundayDate = new Date(rotationDate)
    sundayDate.setDate(sundayDate.getDate() - 1)
    
    shiftStartDateTime = new Date(sundayDate)
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