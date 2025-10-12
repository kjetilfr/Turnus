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

    // Find F3 rotations in helping plan
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

    // HOVUDREGELEN (Annenhver rød dag fri) - UPDATED IMPLEMENTATION
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
        // Extract the main red day date (not the timezone start)
        // For Sunday zones, the main day is Sunday
        // For holiday zones, the main day is the holiday date itself
        let mainDate: Date
        
        if (zw.zone.localName === 'Søndag') {
          // For Sunday zones:
          // - Zone starts: Saturday 18:00
          // - Zone ends: Sunday 22:00
          // The main red day is the SUNDAY
          
          // The endDateTime should be Sunday at 22:00
          const zoneEndDate = new Date(zw.zone.endDateTime)
          
          // Create a new date at midnight of that same day
          mainDate = new Date(
            zoneEndDate.getFullYear(),
            zoneEndDate.getMonth(),
            zoneEndDate.getDate(),
            0, 0, 0, 0
          )
          
          // Verify this is actually a Sunday (day 0 in JS)
          if (mainDate.getDay() !== 0) {
            console.error(`ERROR: Sunday zone date ${mainDate.toISOString()} is not a Sunday (day ${mainDate.getDay()})`)
            // If it's Saturday, something is wrong with the zone creation
            result.details?.push(`WARNING: Sunday zone has incorrect date - expected Sunday but got day ${mainDate.getDay()}`)
          }
        } else {
          // For holidays, the zone ends at 22:00 on the holiday date
          const zoneEndDate = new Date(zw.zone.endDateTime)
          mainDate = new Date(
            zoneEndDate.getFullYear(),
            zoneEndDate.getMonth(),
            zoneEndDate.getDate(),
            0, 0, 0, 0
          )
        }
        
        const dateKey = mainDate.toISOString().split('T')[0]
        
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
        // Calculate the actual date for this F3 rotation
        const f3Date = getRotationDate(helpingPlanStartDate, f3r.week_index, f3r.day_of_week)

        const f3DateKey = f3Date.toISOString().split('T')[0]
        
        // Check if this F3 is on a red day
        if (redDaysWorked.has(f3DateKey)) {
          const entry = redDaysWorked.get(f3DateKey)!
          entry.f3Placed = true
        }
      })

      // Check for violations: F3 must be on the main red day, and no work should be in that timezone
      const redDaysList = Array.from(redDaysWorked.entries()).sort((a, b) => 
        a[1].mainDate.getTime() - b[1].mainDate.getTime()
      )

      // Filter significant work (>= 1 hour)
      const significantRedDays = redDaysList.filter(([_, data]) => 
        data.zones.some(z => z.overlapHours >= 1)
      )

      result.details?.push(`Red days with significant work (≥1h): ${significantRedDays.length}`)
      
      let violationCount = 0
      
      // Under hovudregelen: every OTHER red day should have F3
      significantRedDays.forEach(([dateKey, data], index) => {
        const shouldHaveF3 = (index + 1) % 2 === 0 // Every 2nd red day
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
            // F3 is placed - now check if there's any work in the timezone
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
        result.message = `Hovudregelen: No significant red day work found`
      } else {
        result.status = 'pass'
        result.message = `Hovudregelen: All F3 placements correct`
      }
    }
    // OTHER METHODS - Keep existing implementation
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
        result.details?.push('⚠️ Nokre arbeidsgjevarar og tillitsvalgte har avtalt seg vekk frå korte overlappingar inn i helgedagstidssonar mot andre goder. Sjekk med din tillitsvalgte.')
      } else {
        result.status = 'pass'
        result.message = `Gjennomsnitt: ${zonesWorked.length} zones, avg ${avgHoursPerZone.toFixed(1)}h/zone, ${f3Rotations.length} F3 shift(s).`
      }
    }

    return result
  }
}

/**
 * Given a planStartDate and rotation indices (week_index, day_of_week),
 * return the actual date for that rotation, using Monday-first indexing:
 *  - JS Date.getDay(): 0 = Sunday, ... 6 = Saturday
 *  - Convert: mondayIndex = (jsDay + 6) % 7   => 0 = Monday ... 6 = Sunday
 *
 * This ensures we compute the Monday that starts the plan's first rotation week,
 * then add week_index*7 + day_of_week to get the correct calendar date.
 */
function getRotationDate(planStartDate: Date, weekIndex: number, dayOfWeek: number): Date {
  const d = new Date(planStartDate)
  // Find JS day (0=Sunday..6=Saturday)
  const jsDay = d.getDay()
  // Convert to Monday-first index for that date
  const mondayFirstIndex = (jsDay + 6) % 7 // 0 = Monday, ... 6 = Sunday
  // Subtract that many days to get the Monday of the week
  d.setDate(d.getDate() - mondayFirstIndex)

  // Now add rotations offset: weekIndex weeks + dayOfWeek
  d.setDate(d.getDate() + (weekIndex * 7) + dayOfWeek)
  d.setHours(0, 0, 0, 0)
  return d
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
  // Find the timezone for this F3 date
  const f3DateStr = f3Date.toISOString().split('T')[0]
  
  // Find timezone that corresponds to this date
  const relevantZone = allTimeZones.find(zone => {
    const zoneMainDate = new Date(zone.endDateTime)
    zoneMainDate.setHours(0, 0, 0, 0)
    return zoneMainDate.toISOString().split('T')[0] === f3DateStr
  })
  
  if (!relevantZone) return false
  
  // Check all rotations for work during this timezone
  for (const rotation of rotations) {
    if (!rotation.shift_id) continue
    
    const shift = shifts.find(s => s.id === rotation.shift_id)
    
    // Skip F3 shifts and default shifts
    if (!shift || shift.is_default || !shift.start_time || !shift.end_time) continue
    
    // Calculate actual datetime for this rotation
    const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)
    
    // Check if this shift overlaps with the F3 timezone
    const overlap = calculateTimeZoneOverlap(
      rotation,
      shift,
      relevantZone,
      planStartDate
    )
    
    if (overlap > 0) {
      return true // Found work during F3 timezone
    }
  }
  
  return false
}

function createSundayTimeZones(startDate: Date, endDate: Date): HolidayTimeZone[] {
  const zones: HolidayTimeZone[] = []
  const current = new Date(startDate)
  
  // Find the first Sunday (JS getDay() === 0)
  while (current.getDay() !== 0) {
    current.setDate(current.getDate() + 1)
  }
  
  while (current <= endDate) {
    const sunday = new Date(current)
    const saturday = new Date(current)
    saturday.setDate(saturday.getDate() - 1)
    
    // Sunday timezone: Saturday 18:00 to Sunday 22:00
    const zoneStart = new Date(saturday)
    zoneStart.setHours(18, 0, 0, 0)
    
    const zoneEnd = new Date(sunday)  // This is the Sunday
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

  // IMPORTANT: the rest of your codebase uses Monday-first indexing:
  // 0 = Monday, 6 = Sunday. The previous code incorrectly treated 0 as Sunday.
  // Adjust the Sunday special-case to check for day index 6.
  if (rotation.day_of_week === 6 && isNightShift) {
    // rotation is on SUNDAY (index 6 in Monday-first); night shift started previous day (Saturday)
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
