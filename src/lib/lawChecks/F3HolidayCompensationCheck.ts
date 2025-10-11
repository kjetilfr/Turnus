// src/lib/lawChecks/F3HolidayCompensationCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'

/**
 * F3 Holiday Compensation Check (Helping Plans Only)
 * 
 * Checks that helping plans properly use F3 shifts for holiday compensation.
 * F3 represents mandatory rest following work on holidays (søn- og helgedager).
 * 
 * This check analyzes which weeks of the BASE PLAN ROTATION are worked during
 * the helping plan period, accounting for rotation wrapping. Then verifies
 * the helping plan has appropriate F3 compensation shifts.
 * 
 * Example: 12-week rotation, helping plan weeks 4-7
 * - Helping week 1 = Base rotation week 4
 * - Helping week 2 = Base rotation week 5
 * - etc.
 * 
 * Legal Reference: AML § 10-10 - Søn- og helgedagsarbeid
 */
export const f3HolidayCompensationCheck: LawCheck = {
  id: 'f3-holiday-compensation',
  name: 'F3 Holiday Compensation (Helping Plans)',
  description: 'Verifies that F3 shifts are properly placed after work on holidays. Analyzes which weeks of the BASE ROTATION are worked during the helping plan, then checks F3 placement.',
  category: 'helping',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'AML §10-10 - Søn- og helgedagsarbeid',
      url: 'https://lovdata.no/lov/2005-06-17-62/§10-10'
    }
  ],
  inputs: [],
  
  run: ({ rotations, shifts, plan, basePlanRotations, basePlanShifts, basePlan }) => {
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

    // DEBUG: Log what we received
    console.log('=== F3 CHECK DEBUG ===')
    console.log('basePlan received:', basePlan)
    console.log('basePlan type:', typeof basePlan)
    console.log('basePlanRotations received:', basePlanRotations ? 'YES' : 'NO')
    console.log('basePlanShifts received:', basePlanShifts ? 'YES' : 'NO')
    console.log('plan.base_plan_id:', plan.base_plan_id)
    console.log('plan.type:', plan.type)

    // Only applies to helping plans
    if (plan.type !== 'helping') {
      return {
        status: 'warning',
        message: 'This check only applies to helping plans',
        details: ['F3 holiday compensation is specifically for helping plans']
      }
    }

    // Must have a base plan
    if (!plan.base_plan_id) {
      return {
        status: 'warning',
        message: 'No base plan found',
        details: ['Helping plans must have a base plan (main plan) to check F3 compensation against']
      }
    }

    // Must have base plan data
    if (!basePlanRotations || !basePlanShifts) {
      return {
        status: 'warning',
        message: 'Base plan data not available',
        details: ['Cannot analyze F3 compensation without base plan rotations and shifts']
      }
    }

    // Find F3 shift in the helping plan
    const f3Shift = shifts.find((s: Shift) => s.name === 'F3' && s.is_default)
    
    if (!f3Shift) {
      return {
        status: 'warning',
        message: 'F3 shift type not found in this helping plan',
        details: ['F3 shifts are required for holiday compensation in helping plans']
      }
    }

    // Calculate base plan rotation length
    const maxWeek = Math.max(...basePlanRotations.map(r => r.week_index))
    const basePlanRotationLength = maxWeek + 1
    
    console.log('=== F3 Holiday Compensation Check ===')
    console.log('Helping Plan:', plan.name)
    console.log('Base Plan Rotation Length:', basePlanRotationLength, 'weeks')
    console.log('Helping Plan Duration:', plan.duration_weeks, 'weeks')
    
    // CRITICAL: Calculate week offset to map helping plan weeks to base plan rotation weeks
    // This determines which week of the base plan rotation each helping plan week corresponds to
    
    let weekOffset = 0
    
    if (basePlan) {
      // We have the full base plan - calculate proper offset using the SAME logic as ImportRotationModal
      const basePlanStartDate = new Date(basePlan.date_started)
      const helpingPlanStartDate = new Date(plan.date_started)
      
      // Calculate difference in days
      const diffTime = helpingPlanStartDate.getTime() - basePlanStartDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      // Convert to weeks (can be negative if helping plan starts before base plan)
      const diffWeeks = Math.floor(diffDays / 7)
      
      // Calculate offset (wrapping around base plan's duration)
      // This matches the logic in ImportRotationModal exactly
      weekOffset = diffWeeks % basePlanRotationLength
      if (weekOffset < 0) {
        weekOffset += basePlanRotationLength
      }
      
      console.log('Base Plan Start:', basePlan.date_started)
      console.log('Helping Plan Start:', plan.date_started)
      console.log('Days Difference:', diffDays)
      console.log('Weeks Difference:', diffWeeks)
      console.log('Week Offset:', weekOffset, '(helping week 1 = base rotation week', weekOffset + 1, ')')
    } else {
      // No base plan object - fall back to default
      console.log('WARNING: No base plan object provided, using offset 0')
      console.log('Week Offset:', weekOffset, '(helping week 1 = base rotation week 1)')
    }
    
    const helpingPlanStartDate = new Date(plan.date_started)

    // Create a virtual "effective rotations" array that maps helping plan weeks
    // to the correct base plan rotation weeks with wrapping
    const effectiveRotations: Rotation[] = []
    
    for (let helpingWeek = 0; helpingWeek < plan.duration_weeks; helpingWeek++) {
      // Calculate which base rotation week this corresponds to
      const baseRotationWeek = (helpingWeek + weekOffset) % basePlanRotationLength
      
      // Get all rotations from that base week
      const baseWeekRotations = basePlanRotations.filter(r => r.week_index === baseRotationWeek)
      
      // Create virtual rotations that map to the helping plan's timeline
      baseWeekRotations.forEach(baseRotation => {
        effectiveRotations.push({
          ...baseRotation,
          week_index: helpingWeek, // Map to helping plan week
          plan_id: plan.id // Use helping plan ID
        })
      })
    }
    
    console.log('Effective Rotations Created:', effectiveRotations.length)
    console.log('Sample mapping: Helping Week 1 uses Base Rotation Week', (0 + weekOffset) % basePlanRotationLength + 1)

    // Now analyze holiday time zones using the helping plan's actual date range
    const helpingPlanEndDate = new Date(helpingPlanStartDate)
    helpingPlanEndDate.setDate(helpingPlanEndDate.getDate() + (plan.duration_weeks * 7))
    
    const startYear = helpingPlanStartDate.getFullYear()
    const endYear = helpingPlanEndDate.getFullYear()
    
    // Get all holiday time zones for relevant years
    const allTimeZones: HolidayTimeZone[] = []
    for (let year = startYear; year <= endYear; year++) {
      allTimeZones.push(...getHolidayTimeZones(year))
    }
    
    // Add Sunday time zones
    const sundayZones = createSundayTimeZones(helpingPlanStartDate, helpingPlanEndDate)
    allTimeZones.push(...sundayZones)
    
    // Filter to only zones within the HELPING plan's date range
    const relevantTimeZones = allTimeZones.filter(zone => {
      return zone.startDateTime < helpingPlanEndDate && zone.endDateTime > helpingPlanStartDate
    })
    
    relevantTimeZones.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

    console.log('Relevant time zones (within helping plan dates):', relevantTimeZones.length)

    // Analyze EFFECTIVE ROTATIONS (mapped from base plan) for work in holiday time zones
    const zonesWorked: Array<{
      zone: typeof relevantTimeZones[0]
      overlapHours: number
      rotations: Array<{
        rotation: Rotation
        shift: Shift
        hours: number
      }>
    }> = []

    relevantTimeZones.forEach(zone => {
      let totalOverlapHours = 0
      const rotationsInZone: Array<{ rotation: Rotation; shift: Shift; hours: number }> = []

      // Check each EFFECTIVE rotation (which represents base plan work during helping plan period)
      effectiveRotations.forEach(rotation => {
        if (!rotation.shift_id) return
        
        const shift = basePlanShifts.find(s => s.id === rotation.shift_id)
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

        // Calculate overlap using HELPING PLAN's start date and the rotation's week index
        const overlapHours = calculateTimeZoneOverlap(
          rotation,
          shift,
          zone,
          helpingPlanStartDate // Use HELPING plan start date for date calculations
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

    console.log('\n=== Holiday Time Zones Worked ===')
    console.log(`Found ${zonesWorked.length} zones with work`)
    zonesWorked.forEach((zw, index) => {
      console.log(
        `${index + 1}. ${zw.zone.localName} (${zw.zone.type}):`,
        `${zw.overlapHours.toFixed(2)}h worked`
      )
    })

    // Analyze F3 placement in HELPING PLAN
    const f3Rotations = rotations.filter((r: Rotation) => {
      const shift = shifts.find((s: Shift) => s.id === r.shift_id)
      return shift?.name === 'F3'
    })

    console.log('\n=== F3 Shifts in HELPING PLAN ===')
    console.log(`Found ${f3Rotations.length} F3 shifts`)

    // Build result
    result.details = [
      `Analyzing BASE PLAN ROTATION during helping plan period`,
      `Base rotation length: ${basePlanRotationLength} weeks`,
      `Helping plan period: ${plan.date_started} to ${helpingPlanEndDate.toISOString().split('T')[0]} (${plan.duration_weeks} weeks)`,
      `Week offset: ${weekOffset} (helping week 1 = base rotation week ${weekOffset + 1})`,
      `Holiday/Sunday time zones worked: ${zonesWorked.length}`,
      `Total hours in zones: ${zonesWorked.reduce((sum, zw) => sum + zw.overlapHours, 0).toFixed(2)}h`,
      `F3 compensation shifts in helping plan: ${f3Rotations.length}`,
      ''
    ]

    if (zonesWorked.length > 0) {
      result.details.push('Holiday/Sunday Time Zones Worked:')
      zonesWorked.forEach((zw, index) => {
        const zoneStart = formatDateTime(zw.zone.startDateTime)
        const zoneEnd = formatDateTime(zw.zone.endDateTime)
        result.details?.push(
          `  ${index + 1}. ${zw.zone.localName} (${zw.zone.type}): ${zw.overlapHours.toFixed(2)}h`
        )
        result.details?.push(`     Zone: ${zoneStart} → ${zoneEnd}`)
        
        zw.rotations.forEach(r => {
          const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          const baseRotationWeek = (r.rotation.week_index + weekOffset) % basePlanRotationLength
          result.details?.push(
            `     • Helping Week ${r.rotation.week_index + 1} (Base Week ${baseRotationWeek + 1}), ${dayNames[r.rotation.day_of_week]}: ${r.shift.name} (${r.hours.toFixed(2)}h overlap)`
          )
        })
      })
    } else {
      result.details.push('No holiday/Sunday time zones worked during helping plan period')
    }

    if (f3Rotations.length > 0) {
      result.details?.push('', 'F3 Compensation Shifts in HELPING PLAN:')
      f3Rotations.forEach(f3r => {
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        const rotationDate = new Date(helpingPlanStartDate)
        const daysToAdd = (f3r.week_index * 7) + f3r.day_of_week
        rotationDate.setDate(rotationDate.getDate() + daysToAdd)
        const dateString = rotationDate.toISOString().split('T')[0]
        
        result.details?.push(
          `  Week ${f3r.week_index + 1}, ${dayNames[f3r.day_of_week]}: ${dateString}`
        )
      })
    }

    // Set status based on findings
    if (zonesWorked.length > 0 && f3Rotations.length === 0) {
      result.status = 'fail'
      result.message = `Found ${zonesWorked.length} holiday/Sunday zone(s) worked but NO F3 compensation shifts`
    } else if (zonesWorked.length > f3Rotations.length) {
      result.status = 'warning'
      result.message = `Found ${zonesWorked.length} holiday/Sunday zone(s) worked but only ${f3Rotations.length} F3 shift(s)`
    } else {
      result.status = 'pass'
      result.message = `Found ${zonesWorked.length} holiday/Sunday zone(s) worked and ${f3Rotations.length} F3 shift(s)`
    }

    return result
  }
}

/**
 * Create Sunday time zones using standard definition (Saturday 18:00 → Sunday 22:00)
 */
function createSundayTimeZones(startDate: Date, endDate: Date): HolidayTimeZone[] {
  const zones: HolidayTimeZone[] = []
  const current = new Date(startDate)
  
  // Start from the first Sunday on or after startDate
  while (current.getDay() !== 0) {
    current.setDate(current.getDate() + 1)
  }
  
  // Generate Sunday zones until we reach endDate
  while (current <= endDate) {
    const sunday = new Date(current)
    const saturday = new Date(current)
    saturday.setDate(saturday.getDate() - 1)
    
    // Standard Sunday zone: Saturday 18:00 → Sunday 22:00
    const zoneStart = new Date(saturday)
    zoneStart.setHours(18, 0, 0, 0)
    
    const zoneEnd = new Date(sunday)
    zoneEnd.setHours(22, 0, 0, 0)
    
    // Only add if the zone is within our date range
    if (zoneEnd >= startDate && zoneStart <= endDate) {
      zones.push({
        holidayName: 'Sunday',
        localName: 'Søndag',
        startDateTime: zoneStart,
        endDateTime: zoneEnd,
        type: 'standard'
      })
    }
    
    // Move to next Sunday
    current.setDate(current.getDate() + 7)
  }
  
  return zones
}

/**
 * Calculate overlap between a shift and a holiday time zone
 */
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

  // Calculate actual DateTime for this rotation's shift
  const rotationDate = new Date(planStartDate)
  const daysToAdd = (rotation.week_index * 7) + rotation.day_of_week
  rotationDate.setDate(rotationDate.getDate() + daysToAdd)

  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  // Handle Monday night shift (starts Sunday)
  if (rotation.day_of_week === 0 && isNightShift) {
    const sundayDate = new Date(rotationDate)
    sundayDate.setDate(sundayDate.getDate() - 1)
    
    shiftStartDateTime = new Date(sundayDate)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)
    
    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } 
  // Handle other night shifts
  else if (isNightShift) {
    const prevDay = new Date(rotationDate)
    prevDay.setDate(prevDay.getDate() - 1)
    
    shiftStartDateTime = new Date(prevDay)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)
    
    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } 
  // Regular day shift
  else {
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
    return overlapMillis / (1000 * 60 * 60) // Convert to hours
  }

  return 0
}

/**
 * Format DateTime for display
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString('no-NO', {
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}