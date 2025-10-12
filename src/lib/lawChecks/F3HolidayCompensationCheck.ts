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

    // Get calculation method from inputs (will be set by LawCheckCard UI)
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

    // Build details
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

    if (zonesWorked.length > 0) {
      result.details.push('Holiday/Sunday Time Zones Worked:')
      zonesWorked.forEach((zw, index) => {
        result.details?.push(
          `  ${index + 1}. ${zw.zone.localName}: ${zw.overlapHours.toFixed(2)}h from ${zw.rotations.length} shift(s)`
        )
      })
    }

    if (f3Rotations.length > 0) {
      result.details?.push('', 'F3 Compensation Shifts:')
      f3Rotations.forEach(f3r => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        result.details?.push(`  Week ${f3r.week_index + 1}, ${dayNames[f3r.day_of_week]}`)
      })
    }

    // Categorize zones
    const shortOverlapZones = zonesWorked.filter(zw => zw.overlapHours < 1)
    const significantWorkZones = zonesWorked.filter(zw => zw.overlapHours >= 1)
    
    // Apply calculation method
    if (calculationMethod === 'hovedregelen') {
      const requiredF3 = Math.ceil(significantWorkZones.length / 2)
      
      if (significantWorkZones.length > 0 && f3Rotations.length === 0) {
        result.status = 'fail'
        result.message = `Hovudregelen: ${significantWorkZones.length} zone(s) worked but NO F3. Expected ${requiredF3} F3 shift(s).`
      } else if (f3Rotations.length < requiredF3) {
        result.status = 'warning'
        result.message = `Hovudregelen: ${significantWorkZones.length} zone(s) worked, ${f3Rotations.length} F3 shift(s). Expected ${requiredF3}.`
      } else if (shortOverlapZones.length > 0) {
        result.status = 'warning'
        result.message = `Hovudregelen: ${zonesWorked.length} zones (${shortOverlapZones.length} <1h), ${f3Rotations.length} F3 shift(s).`
        result.details?.push('')
        result.details?.push('⚠️ Nokre arbeidsgjevarar og tillitsvalgte har avtalt seg vekk frå korte overlappingar inn i helgedagstidssonar mot andre goder. Sjekk med din tillitsvalgte.')
      } else {
        result.status = 'pass'
        result.message = `Hovudregelen: ${zonesWorked.length} zones worked, ${f3Rotations.length} F3 shift(s). Compliant.`
      }
    } else if (calculationMethod === 'annenhver') {
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
      
      if (significantWorkZones.length > 0 && f3Rotations.length === 0) {
        result.status = 'fail'
        result.message = `Gjennomsnitt: ${significantWorkZones.length} zone(s) worked but NO F3 compensation.`
      } else if (shortOverlapZones.length > 0) {
        result.status = 'warning'
        result.message = `Gjennomsnitt: ${zonesWorked.length} zones, avg ${avgHoursPerZone.toFixed(1)}h/zone, ${f3Rotations.length} F3 shift(s).`
        result.details?.push('')
        result.details?.push('⚠️ Nokre arbeidsgjevarar og tillitsvalgte har avtalt seg vekk frå korte overlappingar inn i helgedagstidssonar mot andre goder. Sjekk med din tillitsvalgte.')
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