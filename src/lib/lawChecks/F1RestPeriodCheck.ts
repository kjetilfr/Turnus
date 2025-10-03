// src/lib/lawChecks/F1RestPeriodCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'

/**
 * F1 Rest Period Check (35 hours)
 * Checks that there is adequate rest time around F1 shifts
 */
export const f1RestPeriodCheck: LawCheck = {
  id: 'f1-rest-period',
  name: 'F1 Shift Rest Period',
  description: 'Verifies that F1 shifts have adequate rest time before and after (default 35 hours). Checks that only one F1 shift is placed per week and warns if any week is missing an F1 shift.',
  category: 'shared',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'AML §10-8 (2) - Daglig og ukentlig arbeidsfri',
      url: 'https://lovdata.no/dokument/NL/lov/2005-06-17-62/KAPITTEL_4#%C2%A710-8'
    },
    {
      title: 'AML §10-8 (3) - Daglig og ukentlig arbeidsfri',
      url: 'https://lovdata.no/dokument/NL/lov/2005-06-17-62/KAPITTEL_4#%C2%A710-8'
    }
  ],
  applicableTo: ['main', 'helping', 'year'], // Applies to all plan types
  inputs: [
    {
      id: 'minRestHours',
      label: 'Minimum Rest Hours',
      type: 'number',
      defaultValue: 35,
      min: 0,
      max: 72,
      step: 0.5,
      unit: 'hours'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const minRestHours = (inputs.minRestHours as number) || 35
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

    // Find F1 shift
    const f1Shift = shifts.find((s: Shift) => s.name === 'F1' && s.is_default)
    
    if (!f1Shift) {
      return {
        status: 'warning',
        message: 'F1 shift type not found in this plan',
        details: ['F1 shifts are required for proper rest period management']
      }
    }

    // Find all F1 rotations
    const f1Rotations = rotations.filter((r: Rotation) => r.shift_id === f1Shift.id)

    // Group rotations by week to check for F1 presence
    const weeklyF1Count: Record<number, number> = {}
    const weeklyRotations: Record<number, Rotation[]> = {}
    const weekIssues: Record<number, string[]> = {}
    
    // Initialize weeks
    for (let week = 0; week < plan.duration_weeks; week++) {
      weeklyF1Count[week] = 0
      weeklyRotations[week] = []
      weekIssues[week] = []
    }
    
    // Count F1 shifts per week and collect all rotations
    rotations.forEach((r: Rotation) => {
      weeklyRotations[r.week_index] = weeklyRotations[r.week_index] || []
      weeklyRotations[r.week_index].push(r)
      
      if (r.shift_id === f1Shift.id) {
        weeklyF1Count[r.week_index] = (weeklyF1Count[r.week_index] || 0) + 1
      }
    })

    let hasErrors = false
    let hasWarnings = false

    // Check each week for issues
    for (let week = 0; week < plan.duration_weeks; week++) {
      const f1Count = weeklyF1Count[week] || 0
      const weekRotations = weeklyRotations[week] || []
      
      // Issue 1: Multiple F1 shifts in one week
      if (f1Count > 1) {
        weekIssues[week].push(`Multiple F1 shifts (${f1Count}) - should be max 1`)
        hasErrors = true
        result.violations?.push({
          weekIndex: week,
          dayOfWeek: -1,
          description: 'Multiple F1 shifts in same week'
        })
        
        // Still check rest periods for each F1 shift
        const weekF1Rotations = f1Rotations.filter((r: Rotation) => r.week_index === week)
        weekF1Rotations.forEach(f1Rotation => {
          const restIssue = checkRestPeriod(
            weekRotations,
            shifts,
            f1Rotation.day_of_week,
            minRestHours,
            false
          )
          
          if (restIssue) {
            weekIssues[week].push(restIssue)
            hasErrors = true
          }
        })
      }
      
      // Issue 2: Missing F1 shift
      else if (f1Count === 0) {
        weekIssues[week].push('No F1 shift found')
        hasWarnings = true
        result.violations?.push({
          weekIndex: week,
          dayOfWeek: -1,
          description: 'Missing F1 shift'
        })
        
        // Check rest period with assumed F1 day
        const firstDayWithoutShift = Array.from({ length: 7 }, (_, day) => day)
          .find(day => !weekRotations.some(r => r.day_of_week === day))
        
        if (firstDayWithoutShift !== undefined) {
          const restIssue = checkRestPeriod(
            weekRotations, 
            shifts, 
            firstDayWithoutShift, 
            minRestHours,
            true
          )
          
          if (restIssue) {
            weekIssues[week].push(restIssue)
            hasErrors = true
          }
        }
      }
      
      // Issue 3: Rest period violation (for weeks with exactly 1 F1)
      else if (f1Count === 1) {
        const f1Rotation = f1Rotations.find((r: Rotation) => r.week_index === week)
        
        if (f1Rotation) {
          const restIssue = checkRestPeriod(
            weekRotations,
            shifts,
            f1Rotation.day_of_week,
            minRestHours,
            false
          )
          
          if (restIssue) {
            weekIssues[week].push(restIssue)
            hasErrors = true
          }
        }
      }
    }

    // Build details list organized by week
    const detailsList: string[] = []
    let totalIssueCount = 0
    
    for (let week = 0; week < plan.duration_weeks; week++) {
      if (weekIssues[week].length > 0) {
        totalIssueCount += weekIssues[week].length
        weekIssues[week].forEach(issue => {
          detailsList.push(`Week ${week + 1}: ${issue}`)
        })
      }
    }

    // Set final status and message
    if (hasErrors) {
      result.status = 'fail'
      result.message = `Found ${totalIssueCount} issue${totalIssueCount !== 1 ? 's' : ''} across ${Object.keys(weekIssues).filter(w => weekIssues[parseInt(w)].length > 0).length} week${Object.keys(weekIssues).filter(w => weekIssues[parseInt(w)].length > 0).length !== 1 ? 's' : ''}`
      result.details = detailsList
    } else if (hasWarnings) {
      result.status = 'warning'
      result.message = `Found ${totalIssueCount} warning${totalIssueCount !== 1 ? 's' : ''} across ${Object.keys(weekIssues).filter(w => weekIssues[parseInt(w)].length > 0).length} week${Object.keys(weekIssues).filter(w => weekIssues[parseInt(w)].length > 0).length !== 1 ? 's' : ''}`
      result.details = detailsList
    } else {
      result.status = 'pass'
      result.message = `All F1 shifts comply with ${minRestHours}h rest period requirement`
      result.details = [
        `Total F1 shifts: ${f1Rotations.length}`,
        `All weeks have exactly one F1 shift`,
        'All rest periods are adequate'
      ]
    }

    return result
  }
}

// Helper function to check rest period around a specific day
function checkRestPeriod(
  weekRotations: Rotation[],
  shifts: Shift[],
  f1Day: number,
  minRestHours: number,
  isAssumedF1: boolean
): string | null {
  // Find last shift before F1
  let lastShiftEnd: { day: number; time: string } | null = null
  
  for (let day = f1Day - 1; day >= 0; day--) {
    const rotation = weekRotations.find(r => r.day_of_week === day && r.shift_id)
    
    if (rotation) {
      const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
      if (shift && shift.end_time) {
        lastShiftEnd = { day, time: shift.end_time }
        break
      }
    }
  }

  // Find next shift after F1
  let nextShiftStart: { day: number; time: string } | null = null
  
  for (let day = f1Day + 1; day < 7; day++) {
    const rotation = weekRotations.find(r => r.day_of_week === day && r.shift_id)
    
    if (rotation) {
      const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
      if (shift && shift.start_time) {
        nextShiftStart = { day, time: shift.start_time }
        break
      }
    }
  }

  // Calculate rest period if both shifts exist
  if (lastShiftEnd && nextShiftStart) {
    const parseTime = (time: string) => {
      const [h, m] = time.split(':').map(Number)
      return h * 60 + m
    }

    const lastEndMinutes = parseTime(lastShiftEnd.time)
    const nextStartMinutes = parseTime(nextShiftStart.time)
    
    const daysBetween = nextShiftStart.day - lastShiftEnd.day
    const restMinutes = (daysBetween * 24 * 60) - lastEndMinutes + nextStartMinutes
    const restHours = restMinutes / 60

    if (restHours < minRestHours) {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      if (isAssumedF1) {
        return `Insufficient rest period: ${restHours.toFixed(1)}h (tested as if ${dayNames[f1Day]} was F1) - requires ${minRestHours}h`
      } else {
        return `Insufficient rest period: ${restHours.toFixed(1)}h - requires ${minRestHours}h`
      }
    }
  }

  return null
}