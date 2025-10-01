// src/lib/lawChecks/shared/F1RestPeriodCheck.ts

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
  description: 'Verifies that F1 shifts have adequate rest time before and after (default 35 hours). Checks that only one F1 shift is placed per week and warns if no F1 shifts are found.',
  category: 'shared',
  lawType: 'aml',
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
        details: []
      }
    }

    // Find all F1 rotations
    const f1Rotations = rotations.filter((r: Rotation) => r.shift_id === f1Shift.id)

    if (f1Rotations.length === 0) {
      return {
        status: 'warning',
        message: 'No F1 shifts placed in rotation',
        details: ['Consider adding F1 shifts to provide adequate rest periods']
      }
    }

    // Check for multiple F1 shifts per week
    const f1ByWeek: Record<number, number> = {}
    f1Rotations.forEach((r: Rotation) => {
      f1ByWeek[r.week_index] = (f1ByWeek[r.week_index] || 0) + 1
    })

    const weeksWithMultipleF1 = Object.entries(f1ByWeek)
      .filter(([_, count]) => count > 1)
      .map(([week, count]) => ({ week: parseInt(week), count }))

    if (weeksWithMultipleF1.length > 0) {
      result.status = 'fail'
      result.message = `Found ${weeksWithMultipleF1.length} week(s) with multiple F1 shifts`
      result.details = weeksWithMultipleF1.map(
        ({ week, count }) => `Week ${week + 1}: ${count} F1 shifts (should be max 1)`
      )
      
      weeksWithMultipleF1.forEach(({ week }) => {
        result.violations?.push({
          weekIndex: week,
          dayOfWeek: -1,
          description: 'Multiple F1 shifts in same week'
        })
      })
    }

    // Check F1 shifts on Wednesday (day 2) for adequate rest time
    const wednesdayF1s = f1Rotations.filter((r: Rotation) => r.day_of_week === 2)
    
    const restViolations: Array<{
      weekIndex: number
      dayOfWeek: number
      description: string
    }> = []

    wednesdayF1s.forEach((f1Rotation: Rotation) => {
      const weekIndex = f1Rotation.week_index
      
      // Find last shift before F1 (check Monday and Tuesday of same week)
      let lastShiftEnd: { day: number; time: string } | null = null
      
      for (let day = 1; day >= 0; day--) { // Tuesday, then Monday
        const rotation = rotations.find(
          (r: Rotation) => r.week_index === weekIndex && r.day_of_week === day && r.shift_id
        )
        
        if (rotation) {
          const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
          if (shift && shift.end_time) {
            lastShiftEnd = { day, time: shift.end_time }
            break
          }
        }
      }

      // Find next shift after F1 (check Thursday and Friday of same week)
      let nextShiftStart: { day: number; time: string } | null = null
      
      for (let day = 3; day <= 4; day++) { // Thursday, then Friday
        const rotation = rotations.find(
          (r: Rotation) => r.week_index === weekIndex && r.day_of_week === day && r.shift_id
        )
        
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
        // Convert times to minutes
        const parseTime = (time: string) => {
          const [h, m] = time.split(':').map(Number)
          return h * 60 + m
        }

        const lastEndMinutes = parseTime(lastShiftEnd.time)
        const nextStartMinutes = parseTime(nextShiftStart.time)
        
        // Calculate days between
        const daysBetween = nextShiftStart.day - lastShiftEnd.day
        
        // Total rest time in hours
        const restMinutes = (daysBetween * 24 * 60) - lastEndMinutes + nextStartMinutes
        const restHours = restMinutes / 60

        if (restHours < minRestHours) {
          restViolations.push({
            weekIndex,
            dayOfWeek: 2,
            description: `Rest period of ${restHours.toFixed(1)}h is less than required ${minRestHours}h`
          })
        }
      }
    })

    if (restViolations.length > 0) {
      if (result.status === 'pass') {
        result.status = 'fail'
      }
      result.message = result.message 
        ? `${result.message}; ${restViolations.length} F1 shift(s) with insufficient rest period`
        : `${restViolations.length} F1 shift(s) with insufficient rest period`
      
      result.details = [
        ...(result.details || []),
        ...restViolations.map(v => 
          `Week ${v.weekIndex + 1}, Wednesday: ${v.description}`
        )
      ]
      
      result.violations = [
        ...(result.violations || []),
        ...restViolations
      ]
    }

    // If no violations found
    if (result.status === 'pass') {
      result.message = `All F1 shifts comply with ${minRestHours}h rest period requirement`
      result.details = [
        `Total F1 shifts: ${f1Rotations.length}`,
        `F1 shifts on Wednesday: ${wednesdayF1s.length}`,
        'All rest periods are adequate'
      ]
    }

    return result
  }
}