// src/lib/lawChecks/VacationDaysCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'

/**
 * Vacation Days Check
 * 
 * Verifies that vacation (FE shifts) are properly allocated for plans:
 * - AML: 25 days (all tariffavtale types)
 * - HTA: +5 days (only for ks, staten, oslo tariffavtale)
 * - Total expected: 177.5 hours for full year (scaled for partial plans)
 * - Only Monday–Saturday count as vacation days (Sundays excluded)
 * - Sundays with work (vacation replacing or including hours) can be allowed via input
 * - Checks for 3+ consecutive weeks of vacation
 * - Validates 16h rest rule around vacation periods
 */
export const vacationDaysCheck: LawCheck = {
  id: 'vacation-days',
  name: 'Ferie',
  description:
    'Verifiserer korrekt tildeling av feriedagar i planane: 25 dagar (AML) + 5 dagar (HTA) = 177,5 timar for eit heilt år. Berre måndag til laurdag vert rekna som feriedagar. Søndagar med arbeid kan tillatast eksplisitt. Kontrollerer òg tre eller fleire samanhengande veker og 16-timars kvileregel. Søndagar er ikkje virkedagar og kan difor ikkje vere feriedagar, men mange har avtalt ein søndag fri per år i sin lokale turnusavtale.',
  category: 'shared',
  lawType: 'hta',
  lawReferences: [
    {
      title: 'AML §12-5 - Ferie',
      url: 'https://lovdata.no/lov/2005-06-17-62/§12-5'
    },
    {
      title: 'HTA - Tilleggsferie',
      url: 'https://www.ks.no/fagomrader/lonn-og-tariff/tariffavtaler/'
    }
  ],
  applicableTo: ['year', 'helping'],
  inputs: [
    {
      id: 'allowedSundayVacationDays',
      label: 'Søndagar med fri i turnusavtalen',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 52,
      step: 1,
      unit: 'Søndagar'
    }
  ],

  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

    const allowedSundayVacationDays = (inputs.allowedSundayVacationDays as number) || 0
    const weeks = plan.duration_weeks || 52
    const fractionOfYear = weeks / 52

    result.details?.push(`Plan type: ${plan.type} (${weeks} weeks)`)
    result.details?.push(`Work percent: ${plan.work_percent}%`)
    result.details?.push('')

    // Determine vacation entitlement
    const amlDays = 25 * fractionOfYear
    let htaDays = 0
    if (['ks', 'staten', 'oslo', 'spekter'].includes(plan.tariffavtale)) {
      htaDays = 5 * fractionOfYear
    }

    const totalRequiredDays = amlDays + htaDays
    const expectedHours = 177.5 * fractionOfYear * (plan.work_percent / 100)

    result.details?.push(
      '=== VACATION ENTITLEMENT ===',
      `Tariffavtale: ${plan.tariffavtale.toUpperCase()}`,
      `AML days (scaled): ${amlDays.toFixed(2)}`,
      `HTA days (scaled): ${htaDays.toFixed(2)}`,
      `Total required vacation days (scaled): ${totalRequiredDays.toFixed(2)}`,
      `Expected vacation hours (scaled): ${expectedHours.toFixed(2)}h`,
      `Allowed Sundays with work (vacation): ${allowedSundayVacationDays}`,
      ''
    )

    // Find FE (vacation) shift
    const feShift = shifts.find((s: Shift) => s.name.trim().toUpperCase() === 'FE')
    if (!feShift) {
      result.status = 'fail'
      result.message = 'FE (vacation) shift not found'
      result.details?.push('❌ FE shift must be defined to track vacation days')
      result.violations?.push({
        weekIndex: -1,
        dayOfWeek: -1,
        description: 'FE shift type not found in plan'
      })
    }

    // Collect all FE rotations
    const feRotations = rotations.filter(r => {
      if (!feShift) return false
      if (r.shift_id === feShift.id) return true
      if (r.overlay_shift_id === feShift.id && r.overlay_type === 'vacation') return true
      return false
    })

    result.details?.push('=== VACATION TRACKING ===')
    result.details?.push(`Total FE shifts found: ${feRotations.length}`)
    result.details?.push('')

    // Initialize counters
    let vacationDaysCount = 0
    let vacationHoursCount = 0
    let sundayVacationCount = 0
    let daysWithNoShift = 0
    let daysReplacingShift = 0
    const vacationByWeek: Record<number, number> = {}

    // --- Analyze FE rotations ---
    feRotations.forEach(feRotation => {
      const dayOfWeek = feRotation.day_of_week
      const weekIndex = feRotation.week_index
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

      if (!vacationByWeek[weekIndex]) vacationByWeek[weekIndex] = 0

      // Determine replaced hours (if FE overlays another shift)
      let hoursReplaced = 0
      if (feRotation.shift_id && feShift && feRotation.shift_id !== feShift.id) {
        const originalShift = shifts.find(s => s.id === feRotation.shift_id)
        if (originalShift && originalShift.start_time && originalShift.end_time) {
          hoursReplaced = calculateShiftHours(originalShift.start_time, originalShift.end_time)
        }
      }

      // --- Sunday special handling ---
      if (dayOfWeek === 6) {
        let sundayHasWork = false

        // 1️⃣ If FE replaces a shift with hours
        if (hoursReplaced > 0) sundayHasWork = true

        // 2️⃣ If FE itself defines work hours
        if (!sundayHasWork && feShift && feShift.start_time && feShift.end_time) {
          const feHours = calculateShiftHours(feShift.start_time, feShift.end_time)
          if (feHours > 0) {
            sundayHasWork = true
            hoursReplaced = feHours
          }
        }

        // 3️⃣ Only count if work actually exists
        if (sundayHasWork) {
          sundayVacationCount++
          vacationHoursCount += hoursReplaced
          result.details?.push(
            `  Week ${weekIndex + 1}, Sunday: FE replaces or includes ${hoursReplaced.toFixed(2)}h of work`
          )
        } else {
          result.details?.push(
            `  Week ${weekIndex + 1}, Sunday: FE on empty day (not counted)`
          )
        }
        return
      }

      // --- Monday–Saturday vacation handling ---
      vacationDaysCount++
      vacationByWeek[weekIndex]++
      vacationHoursCount += hoursReplaced

      if (hoursReplaced > 0) {
        daysReplacingShift++
        result.details?.push(
          `  Week ${weekIndex + 1}, ${dayNames[dayOfWeek]}: FE replaces ${hoursReplaced.toFixed(2)}h shift`
        )
      } else {
        daysWithNoShift++
        result.details?.push(
          `  Week ${weekIndex + 1}, ${dayNames[dayOfWeek]}: FE on empty day (0h)`
        )
      }
    })

    result.details?.push('')
    result.details?.push('=== SUMMARY ===')
    result.details?.push(`Vacation days (Mon–Sat): ${vacationDaysCount}`)
    result.details?.push(`  - On days with shifts: ${daysReplacingShift}`)
    result.details?.push(`  - On empty days: ${daysWithNoShift}`)
    result.details?.push(`Sundays with work (counted): ${sundayVacationCount}`)
    result.details?.push(`Total vacation hours: ${vacationHoursCount.toFixed(2)}h`)
    result.details?.push('')

    // --- Partial plan summary ---
    if (fractionOfYear < 1) {
      result.details?.push('=== PARTIAL PLAN SUMMARY ===')
      result.details?.push(
        `Vacation entitlement scaled for ${weeks} weeks (${(fractionOfYear*100).toFixed(1)}% of full year)`,
        `Required vacation days: ${totalRequiredDays.toFixed(2)}`,
        `Expected vacation hours: ${expectedHours.toFixed(2)}h`,
        ''
      )
    }

    // --- VALIDATION ---
    result.details?.push('=== VALIDATION ===')

    const daysDifference = vacationDaysCount - totalRequiredDays
    const hoursDifference = vacationHoursCount - expectedHours
    const sundaysDifference = sundayVacationCount - allowedSundayVacationDays

    // Vacation days validation
    if (daysDifference === 0) {
      result.details?.push(`✅ Vacation days: ${vacationDaysCount.toFixed(2)} matches required ${totalRequiredDays.toFixed(2)}`)
    } else if (daysDifference < 0) {
      result.details?.push(`❌ Vacation days: ${vacationDaysCount.toFixed(2)} (missing ${Math.abs(daysDifference).toFixed(2)} days)`)
      result.violations?.push({
        weekIndex: -1,
        dayOfWeek: -1,
        description: `Missing ${Math.abs(daysDifference).toFixed(2)} vacation days`
      })
    } else {
      result.details?.push(`⚠️ Vacation days: ${vacationDaysCount.toFixed(2)} (${daysDifference.toFixed(2)} extra beyond required ${totalRequiredDays.toFixed(2)})`)
    }

    // Vacation hours validation
    if (Math.abs(hoursDifference) < 0.5) {
      result.details?.push(`✅ Vacation hours: ${vacationHoursCount.toFixed(2)}h matches expected ${expectedHours.toFixed(2)}h`)
    } else if (hoursDifference < -0.5) {
      result.details?.push(`❌ Vacation hours: ${vacationHoursCount.toFixed(2)}h (short by ${Math.abs(hoursDifference).toFixed(2)}h)`)
      result.violations?.push({
        weekIndex: -1,
        dayOfWeek: -1,
        description: `Vacation hours short by ${Math.abs(hoursDifference).toFixed(2)}h`
      })
    } else {
      result.details?.push(`⚠️ Vacation hours: ${vacationHoursCount.toFixed(2)}h (${hoursDifference.toFixed(2)}h over expected)`)
    }

    // Sundays validation
    if (sundaysDifference === 0) {
      result.details?.push(`✅ Sundays with work: ${sundayVacationCount} matches allowed ${allowedSundayVacationDays}`)
    } else if (sundaysDifference < 0) {
      result.details?.push(`❌ Sundays with work: ${sundayVacationCount} (missing ${Math.abs(sundaysDifference)} from allowed ${allowedSundayVacationDays})`)
      result.violations?.push({
        weekIndex: -1,
        dayOfWeek: -1,
        description: `Missing ${Math.abs(sundaysDifference)} Sundays with work vacation`
      })
    } else {
      result.details?.push(`❌ Sundays with work: ${sundayVacationCount} (${sundaysDifference} extra beyond allowed ${allowedSundayVacationDays})`)
      result.violations?.push({
        weekIndex: -1,
        dayOfWeek: -1,
        description: `Too many Sundays with FE work (${sundayVacationCount}, allowed ${allowedSundayVacationDays})`
      })
    }

    // --- Check for 3+ consecutive weeks of vacation (18+ consecutive days) ---
    result.details?.push('')
    result.details?.push('=== CONSECUTIVE VACATION DAYS CHECK ===')
    result.details?.push('Rule: 3 weeks = 18 consecutive vacation days (Monday-Sunday)')
    result.details?.push('')

    const consecutiveVacationPeriods = findConsecutiveVacationDays(feRotations, plan)

    if (consecutiveVacationPeriods.length === 0) {
      result.details?.push('ℹ️ No periods with 18+ consecutive vacation days found')
    } else {
      result.details?.push(`✅ Found ${consecutiveVacationPeriods.length} period(s) with 18+ consecutive vacation days:`)
      consecutiveVacationPeriods.forEach(period => {
        const startStr = `Week ${period.startWeek + 1}, ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][period.startDay]}`
        const endStr = `Week ${period.endWeek + 1}, ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][period.endDay]}`
        result.details?.push(
          `  - ${startStr} to ${endStr}: ${period.consecutiveDays} consecutive days`
        )
      })
    }

    // --- Check 16h rest rule around vacation periods (only for 18+ day periods) ---
    result.details?.push('')
    result.details?.push('=== 16-HOUR REST RULE AROUND VACATION ===')
    result.details?.push('Rule: For vacation periods of 18+ days (3 weeks), total time from last shift ending to vacation start + time after vacation ends to first shift start ≥ 16h')
    result.details?.push('')
    
    const vacationPeriods = findVacationPeriods(feRotations, plan)
    // Filter to only periods with 18+ days
    const longVacationPeriods = vacationPeriods.filter(period => {
      const daysDiff = Math.floor((period.endDateTime.getTime() - period.startDateTime.getTime()) / (1000 * 60 * 60 * 24)) + 1
      return daysDiff >= 18
    })
    
    if (longVacationPeriods.length === 0) {
      result.details?.push('ℹ️ No vacation periods of 18+ days found - 16h rest rule does not apply')
    } else {
      result.details?.push(`Found ${longVacationPeriods.length} vacation period(s) of 18+ days to check:`)
      result.details?.push('')
      
      const restViolations = check16HourRestRule(longVacationPeriods, rotations, shifts, plan)

      // Separate actual violations from successful checks
      const actualViolations = restViolations.filter(v => !v.description.startsWith('✅'))
      const successChecks = restViolations.filter(v => v.description.startsWith('✅'))

      if (actualViolations.length === 0) {
        result.details?.push('✅ All long vacation periods meet 16h rest rule')
        // Add success details
        successChecks.forEach(check => {
          result.details?.push(check.description)
        })
      } else {
        actualViolations.forEach(violation => {
          result.details?.push(`❌ ${violation.description}`)
        })
        // Still show successes too
        successChecks.forEach(check => {
          result.details?.push(check.description)
        })
      }
    }

    // --- Set final status without overwriting existing failures ---
    if (result.status !== 'fail' && result.status !== 'warning') {
      if (result.violations && result.violations.length > 0) {
        result.status = 'fail'
        result.message = `Feil i ferietildeling: ${vacationDaysCount.toFixed(2)}/${totalRequiredDays.toFixed(2)} dagar, ${vacationHoursCount.toFixed(2)}t/${expectedHours.toFixed(2)}t. Du har ${expectedHours-vacationHoursCount} for lite timar. Dersom du ikkje får desse timane i år bør du få timane til neste år. $`
      } else if (daysDifference > 1 || hoursDifference > 2.5) {
        result.status = 'warning'
        result.message = `Ferien er betre enn minimumskravet: ${vacationDaysCount.toFixed(2)}/${totalRequiredDays.toFixed(2)} dagar, ${vacationHoursCount.toFixed(2)}t/${expectedHours.toFixed(2)}t.`
      } else {
        result.status = 'pass'
        result.message = `Ferie korrekt tildelt: ${vacationDaysCount.toFixed(2)} dagar, ${vacationHoursCount.toFixed(2)}t (${plan.work_percent}% stillingsprosent)`
      }
    }

    return result
  }
}

/**
 * Find periods of 18 or more consecutive vacation days
 * 18 days = 3 weeks of vacation
 * Checks actual consecutive calendar days, not just weeks
 */
function findConsecutiveVacationDays(
  feRotations: Rotation[],
  plan: Plan
): Array<{ startWeek: number; startDay: number; endWeek: number; endDay: number; consecutiveDays: number }> {
  if (feRotations.length === 0) return []

  const periods: Array<{ startWeek: number; startDay: number; endWeek: number; endDay: number; consecutiveDays: number }> = []
  
  // Sort FE rotations by week then day
  const sortedFE = [...feRotations].sort((a, b) => {
    if (a.week_index !== b.week_index) return a.week_index - b.week_index
    return a.day_of_week - b.day_of_week
  })

  if (sortedFE.length === 0) return []

  const planStartDate = new Date(plan.date_started)
  
  let currentPeriodStart = sortedFE[0]
  let currentPeriodEnd = sortedFE[0]
  let consecutiveDays = 1

  for (let i = 1; i < sortedFE.length; i++) {
    const prevFE = sortedFE[i - 1]
    const currentFE = sortedFE[i]

    // Get actual dates for comparison
    const prevDate = getRotationDate(planStartDate, prevFE.week_index, prevFE.day_of_week)
    const currentDate = getRotationDate(planStartDate, currentFE.week_index, currentFE.day_of_week)

    // Check if current day is exactly one day after previous day
    const nextExpectedDate = new Date(prevDate)
    nextExpectedDate.setDate(nextExpectedDate.getDate() + 1)

    if (currentDate.getTime() === nextExpectedDate.getTime()) {
      // Consecutive day - extend current period
      currentPeriodEnd = currentFE
      consecutiveDays++
    } else {
      // Not consecutive - save current period if >= 18 days
      if (consecutiveDays >= 18) {
        periods.push({
          startWeek: currentPeriodStart.week_index,
          startDay: currentPeriodStart.day_of_week,
          endWeek: currentPeriodEnd.week_index,
          endDay: currentPeriodEnd.day_of_week,
          consecutiveDays
        })
      }
      
      // Start new period
      currentPeriodStart = currentFE
      currentPeriodEnd = currentFE
      consecutiveDays = 1
    }
  }

  // Check final period
  if (consecutiveDays >= 18) {
    periods.push({
      startWeek: currentPeriodStart.week_index,
      startDay: currentPeriodStart.day_of_week,
      endWeek: currentPeriodEnd.week_index,
      endDay: currentPeriodEnd.day_of_week,
      consecutiveDays
    })
  }

  return periods
}

/**
 * Vacation period interface
 */
interface VacationPeriod {
  startWeek: number
  startDay: number
  endWeek: number
  endDay: number
  startDateTime: Date
  endDateTime: Date
}

/**
 * Find all vacation periods (consecutive FE days)
 */
function findVacationPeriods(feRotations: Rotation[], plan: Plan): VacationPeriod[] {
  if (feRotations.length === 0) return []

  // Sort FE rotations by week then day
  const sortedFE = [...feRotations].sort((a, b) => {
    if (a.week_index !== b.week_index) return a.week_index - b.week_index
    return a.day_of_week - b.day_of_week
  })

  const periods: VacationPeriod[] = []
  let currentPeriod: VacationPeriod | null = null

  const planStartDate = new Date(plan.date_started)

  sortedFE.forEach(fe => {
    const feDate = getRotationDate(planStartDate, fe.week_index, fe.day_of_week)

    if (!currentPeriod) {
      // Start new period
      currentPeriod = {
        startWeek: fe.week_index,
        startDay: fe.day_of_week,
        endWeek: fe.week_index,
        endDay: fe.day_of_week,
        startDateTime: new Date(feDate),
        endDateTime: new Date(feDate)
      }
    } else {
      // Check if this FE is consecutive (next day) to the current period
      const lastDate = currentPeriod.endDateTime
      const nextExpectedDate = new Date(lastDate)
      nextExpectedDate.setDate(nextExpectedDate.getDate() + 1)

      if (feDate.getTime() === nextExpectedDate.getTime()) {
        // Consecutive - extend current period
        currentPeriod.endWeek = fe.week_index
        currentPeriod.endDay = fe.day_of_week
        currentPeriod.endDateTime = new Date(feDate)
      } else {
        // Not consecutive - save current period and start new one
        periods.push(currentPeriod)
        currentPeriod = {
          startWeek: fe.week_index,
          startDay: fe.day_of_week,
          endWeek: fe.week_index,
          endDay: fe.day_of_week,
          startDateTime: new Date(feDate),
          endDateTime: new Date(feDate)
        }
      }
    }
  })

  // Save final period
  if (currentPeriod) {
    periods.push(currentPeriod)
  }

  return periods
}

/**
 * Check 16h rest rule around vacation periods
 */
function check16HourRestRule(
  vacationPeriods: VacationPeriod[],
  allRotations: Rotation[],
  shifts: Shift[],
  plan: Plan
): Array<{ description: string }> {
  const violations: Array<{ description: string }> = []
  const planStartDate = new Date(plan.date_started)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  vacationPeriods.forEach(vacPeriod => {
    // Find last shift before vacation starts
    const lastShiftBefore = findLastShiftBefore(
      vacPeriod.startWeek,
      vacPeriod.startDay,
      allRotations,
      shifts
    )

    // Find first shift after vacation ends
    const firstShiftAfter = findFirstShiftAfter(
      vacPeriod.endWeek,
      vacPeriod.endDay,
      allRotations,
      shifts,
      plan.duration_weeks
    )

    // Calculate rest hours
    let restBefore = 0
    let restAfter = 0
    let lastShiftEndDateTime: Date | null = null
    let firstShiftStartDateTime: Date | null = null

    if (lastShiftBefore) {
      const lastShiftDate = getRotationDate(planStartDate, lastShiftBefore.weekIndex, lastShiftBefore.dayOfWeek)
      lastShiftEndDateTime = calculateShiftEndDateTime(lastShiftDate, lastShiftBefore.shift)
      
      // Rest before = vacation start (00:00) - last shift end
      const vacationStartDateTime = new Date(vacPeriod.startDateTime)
      vacationStartDateTime.setHours(0, 0, 0, 0)
      
      const restBeforeMs = vacationStartDateTime.getTime() - lastShiftEndDateTime.getTime()
      restBefore = restBeforeMs / (1000 * 60 * 60)
    }

    if (firstShiftAfter) {
      const firstShiftDate = getRotationDate(planStartDate, firstShiftAfter.weekIndex, firstShiftAfter.dayOfWeek)
      firstShiftStartDateTime = calculateShiftStartDateTime(firstShiftDate, firstShiftAfter.shift)
      
      // Rest after = first shift start - vacation end (24:00 = next day 00:00)
      const vacationEndDateTime = new Date(vacPeriod.endDateTime)
      vacationEndDateTime.setDate(vacationEndDateTime.getDate() + 1) // End of vacation day = start of next day
      vacationEndDateTime.setHours(0, 0, 0, 0)
      
      const restAfterMs = firstShiftStartDateTime.getTime() - vacationEndDateTime.getTime()
      restAfter = restAfterMs / (1000 * 60 * 60)
    }

    const totalRest = restBefore + restAfter

    // Check if total rest is less than 16 hours
    if (lastShiftBefore && firstShiftAfter && totalRest < 16) {
      const vacStartStr = `Week ${vacPeriod.startWeek + 1}, ${dayNames[vacPeriod.startDay]}`
      const vacEndStr = `Week ${vacPeriod.endWeek + 1}, ${dayNames[vacPeriod.endDay]}`
      
      violations.push({
        description: `Vacation ${vacStartStr} to ${vacEndStr}: Total rest ${totalRest.toFixed(2)}h < 16h (before: ${restBefore.toFixed(2)}h, after: ${restAfter.toFixed(2)}h)`
      })
    } else if (lastShiftBefore && firstShiftAfter) {
      // Log successful validation
      const vacStartStr = `Week ${vacPeriod.startWeek + 1}, ${dayNames[vacPeriod.startDay]}`
      const vacEndStr = `Week ${vacPeriod.endWeek + 1}, ${dayNames[vacPeriod.endDay]}`
      
      violations.push({
        description: `✅ Vacation ${vacStartStr} to ${vacEndStr}: Total rest ${totalRest.toFixed(2)}h ≥ 16h (before: ${restBefore.toFixed(2)}h, after: ${restAfter.toFixed(2)}h)`
      })
    }
  })

  return violations
}

/**
 * Find last work shift before a given day
 */
function findLastShiftBefore(
  beforeWeek: number,
  beforeDay: number,
  allRotations: Rotation[],
  shifts: Shift[]
): { weekIndex: number; dayOfWeek: number; shift: Shift } | null {
  // Search backwards from the day before vacation starts
  for (let week = beforeWeek; week >= 0; week--) {
    const startDay = week === beforeWeek ? beforeDay - 1 : 6

    for (let day = startDay; day >= 0; day--) {
      const rotation = allRotations.find(r => 
        r.week_index === week && 
        r.day_of_week === day && 
        r.shift_id !== null
      )

      if (rotation) {
        const shift = shifts.find(s => s.id === rotation.shift_id)
        // Only count work shifts (not FE or other default shifts)
        if (shift && !shift.is_default && shift.start_time && shift.end_time) {
          return {
            weekIndex: week,
            dayOfWeek: day,
            shift
          }
        }
      }
    }
  }

  return null
}

/**
 * Find first work shift after a given day
 */
function findFirstShiftAfter(
  afterWeek: number,
  afterDay: number,
  allRotations: Rotation[],
  shifts: Shift[],
  totalWeeks: number
): { weekIndex: number; dayOfWeek: number; shift: Shift } | null {
  // Search forwards from the day after vacation ends
  for (let week = afterWeek; week < totalWeeks; week++) {
    const startDay = week === afterWeek ? afterDay + 1 : 0

    for (let day = startDay; day < 7; day++) {
      const rotation = allRotations.find(r => 
        r.week_index === week && 
        r.day_of_week === day && 
        r.shift_id !== null
      )

      if (rotation) {
        const shift = shifts.find(s => s.id === rotation.shift_id)
        // Only count work shifts (not FE or other default shifts)
        if (shift && !shift.is_default && shift.start_time && shift.end_time) {
          return {
            weekIndex: week,
            dayOfWeek: day,
            shift
          }
        }
      }
    }
  }

  return null
}

/**
 * Calculate shift end date/time
 */
function calculateShiftEndDateTime(shiftDate: Date, shift: Shift): Date {
  const [endHour, endMin] = shift.end_time!.split(':').map(Number)
  const [startHour] = shift.start_time!.split(':').map(Number)
  
  const result = new Date(shiftDate)
  
  // Check if shift crosses midnight
  if (endHour < startHour || (endHour === startHour && endMin < 0)) {
    // Shift ends next day
    result.setDate(result.getDate() + 1)
  }
  
  result.setHours(endHour, endMin, 0, 0)
  return result
}

/**
 * Calculate shift start date/time
 */
function calculateShiftStartDateTime(shiftDate: Date, shift: Shift): Date {
  const [startHour, startMin] = shift.start_time!.split(':').map(Number)
  const [endHour] = shift.end_time!.split(':').map(Number)
  
  const result = new Date(shiftDate)
  
  // For night shifts shown on Monday that actually start Sunday
  // This is already handled by the rotation grid logic, so we don't adjust here
  
  result.setHours(startHour, startMin, 0, 0)
  return result
}

/**
 * Get rotation date
 */
function getRotationDate(planStartDate: Date, weekIndex: number, dayOfWeek: number): Date {
  const d = new Date(planStartDate)
  const jsDay = d.getDay()
  const mondayFirstIndex = (jsDay + 6) % 7
  d.setDate(d.getDate() - mondayFirstIndex)
  d.setDate(d.getDate() + (weekIndex * 7) + dayOfWeek)
  d.setHours(0, 0, 0, 0)
  return d
}