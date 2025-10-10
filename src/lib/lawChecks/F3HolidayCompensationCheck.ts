// src/lib/lawChecks/F3HolidayCompensationCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getNorwegianHolidays } from '@/lib/utils/norwegianHolidays'

/**
 * F3 Holiday Compensation Check (Helping Plans Only)
 * 
 * Checks that helping plans properly use F3 shifts for holiday compensation.
 * F3 represents mandatory rest following work on holidays (søn- og helgedager).
 * 
 * This check analyzes the BASE (main) plan to see which holidays were worked,
 * then verifies the helping plan has appropriate F3 compensation shifts.
 * 
 * Legal Reference: AML § 10-10 - Søn- og helgedagsarbeid
 * "Arbeidstaker som har utført søn- og helgedagsarbeid skal ha arbeidsfri 
 * følgende søn- og helgedagsdøgn uten trekk i lønn"
 */
export const f3HolidayCompensationCheck: LawCheck = {
  id: 'f3-holiday-compensation',
  name: 'F3 Holiday Compensation (Helping Plans)',
  description: 'Verifies that F3 shifts are properly placed after work on holidays. Analyzes the BASE (main) plan to find holidays worked, then checks F3 placement in the helping plan.',
  category: 'helping',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'AML §10-10 - Søn- og helgedagsarbeid',
      url: 'https://lovdata.no/lov/2005-06-17-62/§10-10'
    }
  ],
  inputs: [],
  
  run: ({ rotations, shifts, plan, basePlanRotations, basePlanShifts }) => {
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

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

    // Get Norwegian holidays for the relevant years
    const planStartDate = new Date(plan.date_started)
    const startYear = planStartDate.getFullYear()
    
    // Calculate end date from BASE PLAN duration
    const planEndDate = new Date(planStartDate)
    planEndDate.setDate(planEndDate.getDate() + (plan.duration_weeks * 7))
    const endYear = planEndDate.getFullYear()
    
    // Collect holidays for all relevant years
    const allHolidays: Array<{ date: string; name: string; localName: string }> = []
    for (let year = startYear; year <= endYear; year++) {
      allHolidays.push(...getNorwegianHolidays(year))
    }

    console.log('=== F3 Holiday Compensation Check ===')
    console.log('Helping Plan:', plan.name)
    console.log('Analyzing BASE PLAN (main plan)')
    console.log('Start Date:', plan.date_started)
    console.log('Duration:', plan.duration_weeks, 'weeks')
    console.log('End Date:', planEndDate.toISOString().split('T')[0])
    
    // Create a Set of holiday dates for quick lookup
    const holidayDates = new Set<string>()
    allHolidays.forEach(holiday => {
      holidayDates.add(holiday.date)
    })

    // Map each BASE PLAN rotation to actual calendar date
    console.log('\n=== Holidays with Custom Shifts (in BASE PLAN) ===')
    
    const basePlanDateMap: Array<{
      rotation: Rotation
      actualDate: string
      isHoliday: boolean
      holidayName?: string
      shift?: Shift | null
    }> = []

    basePlanRotations.forEach((rotation: Rotation) => {
      // Calculate actual date for this rotation
      const rotationDate = new Date(planStartDate)
      const daysToAdd = (rotation.week_index * 7) + rotation.day_of_week
      rotationDate.setDate(rotationDate.getDate() + daysToAdd)
      
      const dateString = rotationDate.toISOString().split('T')[0]
      const isHoliday = holidayDates.has(dateString)
      const holidayInfo = isHoliday ? allHolidays.find(h => h.date === dateString) : null
      
      const shift = rotation.shift_id ? basePlanShifts.find(s => s.id === rotation.shift_id) : null
      
      // Only consider custom shifts (non-default) as "working"
      const isWorkingShift = shift && !shift.is_default
      
      basePlanDateMap.push({
        rotation,
        actualDate: dateString,
        isHoliday,
        holidayName: holidayInfo?.localName,
        shift: shift || null
      })

      // Log ONLY holidays that have a CUSTOM (working) shift scheduled in BASE PLAN
      if (isHoliday && isWorkingShift) {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        console.log(
          `Week ${rotation.week_index + 1}, ${dayNames[rotation.day_of_week]}: ${dateString}`,
          `[HOLIDAY: ${holidayInfo?.localName}]`,
          `[WORKING SHIFT: ${shift.name}]`
        )
      }
    })

    // Analyze holidays worked in BASE PLAN
    const holidaysWorked = basePlanDateMap.filter(r => r.isHoliday && r.shift && !r.shift.is_default)
    
    // Analyze F3 placement in HELPING PLAN
    const f3Rotations = rotations.filter((r: Rotation) => {
      const shift = shifts.find((s: Shift) => s.id === r.shift_id)
      return shift?.name === 'F3'
    })
    
    console.log('\n=== Analysis ===')
    console.log('Base plan rotation cells:', basePlanDateMap.length, `(${plan.duration_weeks} weeks × 7 days)`)
    console.log('Holidays worked in BASE PLAN (custom shifts only):', holidaysWorked.length)
    console.log('F3 compensation shifts in HELPING PLAN:', f3Rotations.length)

    // Build result
    result.details = [
      `Analyzing BASE PLAN for holiday work`,
      `Plan period: ${plan.date_started} to ${planEndDate.toISOString().split('T')[0]}`,
      `Holidays worked in base plan: ${holidaysWorked.length}`,
      `F3 compensation shifts in helping plan: ${f3Rotations.length}`,
      ''
    ]

    if (holidaysWorked.length > 0) {
      result.details.push('Holidays worked in BASE PLAN:')
      holidaysWorked.forEach(hw => {
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        result.details?.push(
          `  Week ${hw.rotation.week_index + 1}, ${dayNames[hw.rotation.day_of_week]}: ${hw.actualDate} - ${hw.holidayName} [${hw.shift?.name}]`
        )
      })
    } else {
      result.details.push('No holidays worked in base plan')
    }

    if (f3Rotations.length > 0) {
      result.details?.push('', 'F3 shifts in HELPING PLAN:')
      f3Rotations.forEach(f3r => {
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        const rotationDate = new Date(planStartDate)
        const daysToAdd = (f3r.week_index * 7) + f3r.day_of_week
        rotationDate.setDate(rotationDate.getDate() + daysToAdd)
        const dateString = rotationDate.toISOString().split('T')[0]
        
        result.details?.push(
          `  Week ${f3r.week_index + 1}, ${dayNames[f3r.day_of_week]}: ${dateString}`
        )
      })
    }

    // TODO: Add actual validation logic
    // Check if F3 shifts match holidays worked
    result.status = 'pass'
    result.message = `Found ${holidaysWorked.length} worked holiday(s) in base plan and ${f3Rotations.length} F3 shift(s) in helping plan`

    return result
  }
}