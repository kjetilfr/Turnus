// src/lib/lawChecks/CompensatingRestCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'

/**
 * Compensating Rest Period Check
 * Checks that rest periods between shifts meet minimum requirements,
 * and that any "debt" from shorter rest periods is compensated in the next rest period.
 * 
 * Rule: If rest period is less than 11h, the next rest period must be:
 * 11h + (11h - actual previous rest)
 */
export const compensatingRestCheck: LawCheck = {
  id: 'compensating-rest-period',
  name: 'Kompenserande Kvile',
  description: 'Verifiserer at kviletid mellom vakter oppfyller minimumskravet (standard 11 timar). Dersom ein kviletid er kortare enn 11 timar, må underskotet kompenserast i neste kviletid ved å leggje til mangelen på 11-timarsgrunnlaget.',
  category: 'shared',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'AML §10-8 (1) - Daglig og ukentlig arbeidsfri',
      url: 'https://lovdata.no/dokument/NL/lov/2005-06-17-62/KAPITTEL_4#%C2%A710-8'
    }
  ],
  applicableTo: ['main', 'helping', 'year'],
  inputs: [
    {
      id: 'minShiftRestHours',
      label: 'Minimum Kvile Mellom Vakter',
      type: 'number',
      defaultValue: 11,
      min: 0,
      max: 24,
      step: 0.5,
      unit: 'timar'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const minRestHours = (inputs.minShiftRestHours as number) || 11
    
    // Validate input
    if (isNaN(minRestHours) || minRestHours < 0) {
      return {
        status: 'warning',
        message: 'Ugyldig konfigurasjon for minimum kviletid',
        details: ['Vennlegst skriv inn eit gyldig tal for minimum kviletid mellom vakter']
      }
    }
    
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

    // Group rotations by week
    const weeklyRotations: Record<number, Rotation[]> = {}
    for (let week = 0; week < plan.duration_weeks; week++) {
      weeklyRotations[week] = []
    }
    
    rotations.forEach((r: Rotation) => {
      if (r.shift_id) {
        const shift = shifts.find((s: Shift) => s.id === r.shift_id)
        // Only include rotations with shifts that have time info
        if (shift && shift.start_time && shift.end_time) {
          weeklyRotations[r.week_index] = weeklyRotations[r.week_index] || []
          weeklyRotations[r.week_index].push(r)
        }
      }
    })

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    let hasErrors = false
    let hasWarnings = false
    const violations: string[] = []

    // Track rest debt across the entire schedule
    let restDebt = 0

    // Process each week
    for (let week = 0; week < plan.duration_weeks; week++) {
      const weekRotations = weeklyRotations[week] || []
      
      // Sort by day of week
      const sortedRotations = [...weekRotations].sort((a, b) => a.day_of_week - b.day_of_week)

      // Check rest periods between consecutive shifts within the week
      for (let i = 0; i < sortedRotations.length - 1; i++) {
        const currentRotation = sortedRotations[i]
        const nextRotation = sortedRotations[i + 1]

        const currentShift = shifts.find((s: Shift) => s.id === currentRotation.shift_id)
        const nextShift = shifts.find((s: Shift) => s.id === nextRotation.shift_id)

        if (!currentShift || !nextShift || !currentShift.end_time || !nextShift.start_time) {
          continue
        }

        // Calculate rest period between shifts
        const restHours = calculateRestPeriod(
          currentRotation.day_of_week,
          currentShift.end_time,
          nextRotation.day_of_week,
          nextShift.start_time
        )

        // Calculate actual required rest for this period
        // If there's debt from previous period, must meet 11h + debt
        // If no debt, just need to meet configured minimum
        const baseRequirement = 11
        const hasDebt = restDebt > 0
        const actualRequiredRest = hasDebt ? (baseRequirement + restDebt) : minRestHours
        
        // Check if rest meets the requirement
        const meetsRequirement = restHours >= actualRequiredRest

        if (!meetsRequirement) {
          hasErrors = true
          
          let violationMsg: string
          if (hasDebt) {
            // Has debt: must meet 11h + debt
            violationMsg = `Week ${week + 1}, ${dayNames[currentRotation.day_of_week]} to ${dayNames[nextRotation.day_of_week]}: Rest period ${restHours.toFixed(2)}h is less than required ${actualRequiredRest.toFixed(2)}h (11h base + ${restDebt.toFixed(2)}h debt from previous period)`
          } else {
            // No debt: must meet configured minimum
            violationMsg = `Week ${week + 1}, ${dayNames[currentRotation.day_of_week]} to ${dayNames[nextRotation.day_of_week]}: Rest period ${restHours.toFixed(2)}h is less than configured minimum ${minRestHours}h`
          }
          
          violations.push(violationMsg)
          
          result.violations?.push({
            weekIndex: week,
            dayOfWeek: currentRotation.day_of_week,
            description: violationMsg
          })
        }
        
        // ALWAYS update debt for next period, even if current period failed
        // This ensures subsequent checks have correct debt information
        if (restHours < baseRequirement) {
          restDebt = baseRequirement - restHours
        } else {
          restDebt = 0
        }

        // Warning if rest period is below 8 hours (critical threshold)
        if (restHours < 8) {
          hasWarnings = true
          violations.push(`Week ${week + 1}, ${dayNames[currentRotation.day_of_week]} to ${dayNames[nextRotation.day_of_week]}: Critical - Rest period ${restHours.toFixed(2)}h is below 8 hours`)
        }
      }

      // Check rest period from last shift of current week to first shift of next week
      if (week < plan.duration_weeks - 1) {
        const lastRotation = sortedRotations[sortedRotations.length - 1]
        const nextWeekRotations = weeklyRotations[week + 1] || []
        const nextWeekSorted = [...nextWeekRotations].sort((a, b) => a.day_of_week - b.day_of_week)
        const firstNextWeek = nextWeekSorted[0]

        if (lastRotation && firstNextWeek) {
          const lastShift = shifts.find((s: Shift) => s.id === lastRotation.shift_id)
          const firstNextShift = shifts.find((s: Shift) => s.id === firstNextWeek.shift_id)

          if (lastShift && firstNextShift && lastShift.end_time && firstNextShift.start_time) {
            const restHours = calculateRestPeriodAcrossWeeks(
              lastRotation.day_of_week,
              lastShift.end_time,
              firstNextWeek.day_of_week,
              firstNextShift.start_time
            )

            const baseRequirement = 11
            const hasDebt = restDebt > 0
            const actualRequiredRest = hasDebt ? (baseRequirement + restDebt) : minRestHours
            
            const meetsRequirement = restHours >= actualRequiredRest

            if (!meetsRequirement) {
              hasErrors = true
              
              let violationMsg: string
              if (hasDebt) {
                violationMsg = `Week ${week + 1} to ${week + 2}, ${dayNames[lastRotation.day_of_week]} to ${dayNames[firstNextWeek.day_of_week]}: Rest period ${restHours.toFixed(2)}h is less than required ${actualRequiredRest.toFixed(2)}h (11h base + ${restDebt.toFixed(2)}h debt)`
              } else {
                violationMsg = `Week ${week + 1} to ${week + 2}, ${dayNames[lastRotation.day_of_week]} to ${dayNames[firstNextWeek.day_of_week]}: Rest period ${restHours.toFixed(2)}h is less than configured minimum ${minRestHours}h`
              }
              
              violations.push(violationMsg)
              
              result.violations?.push({
                weekIndex: week,
                dayOfWeek: lastRotation.day_of_week,
                description: violationMsg
              })
            }
            
            // ALWAYS update debt, even if current period failed
            if (restHours < baseRequirement) {
              restDebt = baseRequirement - restHours
            } else {
              restDebt = 0
            }

            if (restHours < 8) {
              hasWarnings = true
              violations.push(`Week ${week + 1} to ${week + 2}, ${dayNames[lastRotation.day_of_week]} to ${dayNames[firstNextWeek.day_of_week]}: Critical - Rest period ${restHours.toFixed(2)}h is below 8 hours`)
            }
          }
        }
      }
    }

    // Build result
    if (hasErrors) {
      result.status = 'fail'
      result.message = `Fann ${violations.length} brot på kviletid${violations.length !== 1 ? 'er' : ''}`
      result.details = violations
    } else if (hasWarnings) {
      result.status = 'warning'
      result.message = `Fann ${violations.length} åtvaring${violations.length !== 1 ? 'ar' : ''}`
      result.details = violations
    } else {
      result.status = 'pass'
      result.message = `Alle kviletider oppfyller kravet på ${minRestHours} timar med korrekt kompensasjon.`
      result.details = [
        `Minimum required rest: ${minRestHours}h`,
        'All rest periods are adequate',
        'No compensation debt accumulated'
      ]
    }

    return result
  }
}

/**
 * Calculate rest period between two shifts on different days within the same week
 */
function calculateRestPeriod(
  firstDay: number,
  firstEndTime: string,
  secondDay: number,
  secondStartTime: string
): number {
  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const firstEndMinutes = parseTime(firstEndTime)
  const secondStartMinutes = parseTime(secondStartTime)
  
  const daysBetween = secondDay - firstDay
  const restMinutes = (daysBetween * 24 * 60) - firstEndMinutes + secondStartMinutes
  
  return restMinutes / 60
}

/**
 * Calculate rest period between shifts across week boundaries
 */
function calculateRestPeriodAcrossWeeks(
  firstDay: number,
  firstEndTime: string,
  secondDay: number,
  secondStartTime: string
): number {
  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const firstEndMinutes = parseTime(firstEndTime)
  const secondStartMinutes = parseTime(secondStartTime)
  
  // Days from last shift to end of week
  const daysToWeekEnd = 7 - firstDay
  // Days from start of week to first shift of next week
  const daysFromWeekStart = secondDay
  
  const totalDays = daysToWeekEnd + daysFromWeekStart
  const restMinutes = (totalDays * 24 * 60) - firstEndMinutes + secondStartMinutes
  
  return restMinutes / 60
}