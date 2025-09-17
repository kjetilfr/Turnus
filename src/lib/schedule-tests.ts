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
    description: 'Must have at least 35 hours between the shift before F1 and the shift after F1',
    enabled: true
  },
  {
    id: 'f3_sunday_placement',
    name: 'F3 Sunday Placement',
    description: 'F3 shifts should only be placed on Sundays or special red days',
    enabled: true
  }
]

// Helper function to check if a shift is an F shift (F1-F5)
function isFShift(shift: Shift): boolean {
  return /^f[1-5]$/i.test(shift.name.trim())
}

// Helper function to determine if a shift is a nightshift (crosses midnight)
// F shifts are ignored - their times don't matter
function isNightshift(shift: Shift): boolean {
  if (isFShift(shift)) {
    return false // F shifts don't have meaningful times
  }
  return shift.start_time > shift.end_time
}

// Helper function to get the actual start datetime of a shift
// F shifts use arbitrary times since they don't matter for calculations
function getShiftStartDateTime(shift: Shift, dayOfWeek: number, weekIndex: number): Date {
  const baseDate = new Date(2000, 0, 1)
  const totalDays = (weekIndex * 7) + dayOfWeek
  const shiftDate = new Date(baseDate.getTime() + (totalDays * 24 * 60 * 60 * 1000))
  
  if (isFShift(shift)) {
    // F shifts start at beginning of their assigned day (arbitrary)
    shiftDate.setHours(0, 0, 0, 0)
    return shiftDate
  }
  
  const [hours, minutes] = shift.start_time.split(':').map(Number)
  
  if (isNightshift(shift)) {
    // For nightshifts, the actual start is the day before the assigned day
    shiftDate.setDate(shiftDate.getDate() - 1)
  }
  
  shiftDate.setHours(hours, minutes, 0, 0)
  return shiftDate
}

// Helper function to get the actual end datetime of a shift
// F shifts use arbitrary times since they don't matter for calculations
function getShiftEndDateTime(shift: Shift, dayOfWeek: number, weekIndex: number): Date {
  const baseDate = new Date(2000, 0, 1)
  const totalDays = (weekIndex * 7) + dayOfWeek
  const shiftDate = new Date(baseDate.getTime() + (totalDays * 24 * 60 * 60 * 1000))
  
  if (isFShift(shift)) {
    // F shifts end at end of their assigned day (arbitrary)
    shiftDate.setHours(23, 59, 59, 999)
    return shiftDate
  }
  
  const [hours, minutes] = shift.end_time.split(':').map(Number)
  shiftDate.setHours(hours, minutes, 0, 0)
  
  return shiftDate
}

// Helper function to calculate time difference in hours between two shifts
function calculateTimeBetweenShifts(
  firstShift: { shift: Shift; rotation: Rotation },
  secondShift: { shift: Shift; rotation: Rotation }
): number {
  const firstEndTime = getShiftEndDateTime(
    firstShift.shift, 
    firstShift.rotation.day_of_week, 
    firstShift.rotation.week_index
  )
  
  const secondStartTime = getShiftStartDateTime(
    secondShift.shift, 
    secondShift.rotation.day_of_week, 
    secondShift.rotation.week_index
  )
  
  const diffMs = secondStartTime.getTime() - firstEndTime.getTime()
  return diffMs / (1000 * 60 * 60) // Convert to hours
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
  const minTimeOff = plan.f1_time_off || 35
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  console.log('🔍 F1 Debug Information:')
  console.log(`Found ${f1Rotations.length} F1 shifts:`, f1Rotations.map(r => 
    `Week ${r.week_index + 1}, ${dayNames[r.day_of_week]}`
  ))
  console.log(`Required minimum time off: ${minTimeOff} hours`)
  console.log(`F1 is an F shift - times are ignored for calculations`)

  // For each F1 shift, find the shift before and after it
  f1Rotations.forEach((f1Rotation, index) => {
    console.log(`\n🎯 Analyzing F1 shift ${index + 1}: Week ${f1Rotation.week_index + 1} ${dayNames[f1Rotation.day_of_week]}`)
    
    // Find shift before F1 (must not be an F shift)
    const beforeShift = findPreviousNonFShift(f1Rotation, rotations, shifts)
    // Find shift after F1 (must not be an F shift)
    const afterShift = findNextNonFShift(f1Rotation, rotations, shifts)

    if (!beforeShift || !afterShift) {
      console.log(`  ⚠️ Skipping: ${!beforeShift ? 'No non-F shift before' : ''} ${!afterShift ? 'No non-F shift after' : ''}`)
      return
    }

    const timeDiff = calculateTimeBetweenShifts(beforeShift, afterShift)

    console.log(`  📅 Before F1: Week ${beforeShift.rotation.week_index + 1} ${dayNames[beforeShift.rotation.day_of_week]} - ${beforeShift.shift.name}`)
    if (!isFShift(beforeShift.shift)) {
      console.log(`      ${isNightshift(beforeShift.shift) ? '🌙 ' : '☀️ '}${beforeShift.shift.start_time} - ${beforeShift.shift.end_time}`)
    }
    console.log(`  🏥 F1 Shift: Week ${f1Rotation.week_index + 1} ${dayNames[f1Rotation.day_of_week]} (times ignored)`)
    console.log(`  📅 After F1:  Week ${afterShift.rotation.week_index + 1} ${dayNames[afterShift.rotation.day_of_week]} - ${afterShift.shift.name}`)
    if (!isFShift(afterShift.shift)) {
      console.log(`      ${isNightshift(afterShift.shift) ? '🌙 ' : '☀️ '}${afterShift.shift.start_time} - ${afterShift.shift.end_time}`)
    }
    
    console.log(`  ⏱️ Time gap (ignoring F1): ${timeDiff.toFixed(2)} hours`)
    console.log(`  🔍 Status: ${timeDiff >= minTimeOff ? '✅ PASS' : '❌ FAIL'} (minimum: ${minTimeOff}h)`)

    if (timeDiff < minTimeOff) {
      violations.push(
        `F1 on Week ${f1Rotation.week_index + 1} ${dayNames[f1Rotation.day_of_week]}: Only ${timeDiff.toFixed(1)} hours between ${beforeShift.shift.name} and ${afterShift.shift.name} (F1 times ignored) - minimum: ${minTimeOff}h`
      )
    }
  })

  console.log(`\n🏁 F1 Test Summary: ${violations.length === 0 ? 'PASSED' : 'FAILED'} (${violations.length} violations)`)

  return {
    id: 'f1_time_off',
    name: 'F1 Time Off Validation',
    description: `Must have at least ${minTimeOff} hours between the non-F shifts before and after F1`,
    passed: violations.length === 0,
    violations,
    details: `Found ${f1Rotations.length} F1 shifts in schedule. F shift times are ignored in calculations.`
  }
}

// Helper function to find the previous non-F shift before an F1 shift
function findPreviousNonFShift(
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

  // Look backwards for the first non-F shift
  for (let i = f1Index - 1; i >= 0; i--) {
    const rotation = allRotations[i]
    const shift = shifts.find(s => s.id === rotation.shift_id)
    if (shift && !isFShift(shift)) {
      return { rotation, shift }
    }
  }

  return null
}

// Helper function to find the next non-F shift after an F1 shift
function findNextNonFShift(
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

  // Look forwards for the first non-F shift
  for (let i = f1Index + 1; i < allRotations.length; i++) {
    const rotation = allRotations[i]
    const shift = shifts.find(s => s.id === rotation.shift_id)
    if (shift && !isFShift(shift)) {
      return { rotation, shift }
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
    details: `Found ${f3Rotations.length} F3 shifts in schedule. F3 times are ignored - only placement matters.`
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