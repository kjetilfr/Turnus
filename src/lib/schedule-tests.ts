// src/lib/schedule-tests.ts
import type { Plan, Shift, Rotation } from '@/types/scheduler'

export interface TestResult {
  id: string
  name: string
  description: string
  passed: boolean
  violations: string[]
  details?: string
}

export interface TestSuite {
  id: string
  name: string
  description: string
  enabled: boolean
}

export const AVAILABLE_TESTS: TestSuite[] = [
  {
    id: 'f1_time_off',
    name: 'F1 Time Off Validation',
    description: 'F1 shifts must have at least 35 hours (or plan-configured time) between shifts',
    enabled: true
  },
  {
    id: 'f3_sunday_placement',
    name: 'F3 Sunday Placement',
    description: 'F3 shifts should only be placed on Sundays or special red days',
    enabled: true
  }
]

// Helper function to calculate time difference between two time strings
function calculateTimeDifference(
  endTime: string, 
  endDay: number, 
  endWeek: number,
  startTime: string, 
  startDay: number, 
  startWeek: number
): number {
  // Calculate the total minutes from start of plan for each time
  const getMinutesFromPlanStart = (time: string, day: number, week: number) => {
    const [hours, minutes] = time.split(':').map(Number)
    const totalMinutes = (week * 7 * 24 * 60) + (day * 24 * 60) + (hours * 60) + minutes
    return totalMinutes
  }

  const endMinutes = getMinutesFromPlanStart(endTime, endDay, endWeek)
  const startMinutes = getMinutesFromPlanStart(startTime, startDay, startWeek)
  
  const diffMinutes = startMinutes - endMinutes
  return diffMinutes / 60 // Convert to hours
}

// Test F1 time off requirements
function testF1TimeOff(
  plan: Plan,
  shifts: Shift[],
  rotations: Rotation[]
): TestResult {
  const f1Shift = shifts.find(s => s.name.toLowerCase() === 'f1')
  
  if (!f1Shift) {
    return {
      id: 'f1_time_off',
      name: 'F1 Time Off Validation',
      description: 'F1 shifts must have adequate time off between shifts',
      passed: true,
      violations: [],
      details: 'No F1 shift found in plan'
    }
  }

  const f1Rotations = rotations
    .filter(r => r.shift_id === f1Shift.id)
    .sort((a, b) => {
      if (a.week_index !== b.week_index) {
        return a.week_index - b.week_index
      }
      return a.day_of_week - b.day_of_week
    })

  const violations: string[] = []
  const minTimeOff = 35
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  console.log('🔍 F1 Debug Information:')
  console.log(`Found ${f1Rotations.length} F1 shifts:`, f1Rotations.map(r => 
    `Week ${r.week_index + 1}, ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][r.day_of_week]}`
  ))
  console.log(`Required minimum time off: ${minTimeOff} hours`)

  // For each F1 shift, find the shift before and after it
  f1Rotations.forEach((f1Rotation, index) => {
    console.log(`\n🎯 Analyzing F1 shift ${index + 1}: Week ${f1Rotation.week_index + 1} ${dayNames[f1Rotation.day_of_week]}`)
    
    // Find shift before F1
    const beforeShift = findPreviousShift(f1Rotation, rotations, shifts)
    // Find shift after F1  
    const afterShift = findNextShift(f1Rotation, rotations, shifts)

    if (!beforeShift || !afterShift) {
      console.log(`  ⚠️ Skipping: ${!beforeShift ? 'No shift before' : ''} ${!afterShift ? 'No shift after' : ''}`)
      return
    }

    const timeDiff = calculateTimeDifference(
      beforeShift.shift.end_time,
      beforeShift.rotation.day_of_week,
      beforeShift.rotation.week_index,
      afterShift.shift.start_time,
      afterShift.rotation.day_of_week,
      afterShift.rotation.week_index
    )

    console.log(`  📅 Before F1: Week ${beforeShift.rotation.week_index + 1} ${dayNames[beforeShift.rotation.day_of_week]} - ${beforeShift.shift.name} ends at ${beforeShift.shift.end_time}`)
    console.log(`  📅 After F1:  Week ${afterShift.rotation.week_index + 1} ${dayNames[afterShift.rotation.day_of_week]} - ${afterShift.shift.name} starts at ${afterShift.shift.start_time}`)
    console.log(`  ⏱️ Time gap: ${timeDiff.toFixed(2)} hours`)
    console.log(`  🔍 Status: ${timeDiff >= minTimeOff ? '✅ PASS' : '❌ FAIL'} (minimum: ${minTimeOff}h)`)

    if (timeDiff < minTimeOff) {
      violations.push(
        `F1 on Week ${f1Rotation.week_index + 1} ${dayNames[f1Rotation.day_of_week]}: Only ${timeDiff.toFixed(1)} hours between ${beforeShift.shift.name} (ends ${beforeShift.shift.end_time}) and ${afterShift.shift.name} (starts ${afterShift.shift.start_time}) - minimum: ${minTimeOff}h`
      )
    }
  })

  console.log(`\n🏁 F1 Test Summary: ${violations.length === 0 ? 'PASSED' : 'FAILED'} (${violations.length} violations)`)

  return {
    id: 'f1_time_off',
    name: 'F1 Time Off Validation',
    description: `Must have at least ${minTimeOff} hours between the shift before F1 and the shift after F1`,
    passed: violations.length === 0,
    violations,
    details: `Found ${f1Rotations.length} F1 shifts in schedule`
  }
}

// Helper function to find the shift immediately before an F1 shift
function findPreviousShift(
  f1Rotation: Rotation, 
  rotations: Rotation[], 
  shifts: Shift[]
): { rotation: Rotation; shift: Shift } | null {
  // Get all rotations with shifts assigned, sorted chronologically
  const allRotations = rotations
    .filter(r => r.shift_id && r.shift)
    .sort((a, b) => {
      if (a.week_index !== b.week_index) {
        return a.week_index - b.week_index
      }
      return a.day_of_week - b.day_of_week
    })

  // Find the F1 rotation in the sorted list
  const f1Index = allRotations.findIndex(r => 
    r.week_index === f1Rotation.week_index && 
    r.day_of_week === f1Rotation.day_of_week
  )

  // Return the rotation immediately before it
  if (f1Index > 0) {
    const prevRotation = allRotations[f1Index - 1]
    const shift = shifts.find(s => s.id === prevRotation.shift_id)
    if (shift) {
      return { rotation: prevRotation, shift }
    }
  }

  return null
}

// Helper function to find the shift immediately after an F1 shift
function findNextShift(
  f1Rotation: Rotation, 
  rotations: Rotation[], 
  shifts: Shift[]
): { rotation: Rotation; shift: Shift } | null {
  // Get all rotations with shifts assigned, sorted chronologically
  const allRotations = rotations
    .filter(r => r.shift_id && r.shift)
    .sort((a, b) => {
      if (a.week_index !== b.week_index) {
        return a.week_index - b.week_index
      }
      return a.day_of_week - b.day_of_week
    })

  // Find the F1 rotation in the sorted list
  const f1Index = allRotations.findIndex(r => 
    r.week_index === f1Rotation.week_index && 
    r.day_of_week === f1Rotation.day_of_week
  )

  // Return the rotation immediately after it
  if (f1Index >= 0 && f1Index < allRotations.length - 1) {
    const nextRotation = allRotations[f1Index + 1]
    const shift = shifts.find(s => s.id === nextRotation.shift_id)
    if (shift) {
      return { rotation: nextRotation, shift }
    }
  }

  return null
}

// Test F3 Sunday placement
function testF3SundayPlacement(
  plan: Plan,
  shifts: Shift[],
  rotations: Rotation[]
): TestResult {
  const f3Shift = shifts.find(s => s.name.toLowerCase() === 'f3')
  
  if (!f3Shift) {
    return {
      id: 'f3_sunday_placement',
      name: 'F3 Sunday Placement',
      description: 'F3 shifts should only be placed on Sundays or special red days',
      passed: true,
      violations: [],
      details: 'No F3 shift found in plan'
    }
  }

  const f3Rotations = rotations.filter(r => r.shift_id === f3Shift.id)
  const violations: string[] = []
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // TODO: Add support for special red days when that feature is implemented
  const specialRedDays: {week: number, day: number}[] = []

  f3Rotations.forEach(rotation => {
    const isSunday = rotation.day_of_week === 0
    const isSpecialRedDay = specialRedDays.some(
      red => red.week === rotation.week_index && red.day === rotation.day_of_week
    )

    if (!isSunday && !isSpecialRedDay) {
      violations.push(
        `Week ${rotation.week_index + 1} ${dayNames[rotation.day_of_week]}: F3 shift should only be on Sundays or special red days`
      )
    }
  })

  return {
    id: 'f3_sunday_placement',
    name: 'F3 Sunday Placement',
    description: 'F3 shifts should only be placed on Sundays or special red days',
    passed: violations.length === 0,
    violations,
    details: `Found ${f3Rotations.length} F3 shifts in schedule. Special red days feature coming soon.`
  }
}

// Main function to run selected tests
export function runScheduleTests(
  plan: Plan,
  shifts: Shift[],
  rotations: Rotation[],
  enabledTests: string[]
): TestResult[] {
  const results: TestResult[] = []

  if (enabledTests.includes('f1_time_off')) {
    results.push(testF1TimeOff(plan, shifts, rotations))
  }

  if (enabledTests.includes('f3_sunday_placement')) {
    results.push(testF3SundayPlacement(plan, shifts, rotations))
  }

  return results
}