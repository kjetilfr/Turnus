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
 */
export const vacationDaysCheck: LawCheck = {
  id: 'vacation-days',
  name: 'Vacation Days (Ferie)',
  description:
    'Verifies proper allocation of vacation days for plans: 25 days (AML) + 5 days (HTA) = 177.5 hours expected for full year. Only Monday–Saturday count as vacation days. Sundays with work can be allowed explicitly.',
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
      label: 'Allowed Sunday Vacation Days (Sundays with work allowed)',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 52,
      step: 1,
      unit: 'Sundays'
    }
  ],

  run: ({ rotations, shifts, plan, basePlanRotations, basePlanShifts, inputs = {} }) => {
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
    if (['ks', 'staten', 'oslo'].includes(plan.tariffavtale)) {
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

    // --- Set final status without overwriting existing failures ---
    if (result.status !== 'fail' && result.status !== 'warning') {
      if (result.violations && result.violations.length > 0) {
        result.status = 'fail'
        result.message = `Vacation allocation issues: ${vacationDaysCount.toFixed(1)}/${totalRequiredDays.toFixed(1)} days, ${vacationHoursCount.toFixed(1)}/${expectedHours.toFixed(1)}h`
      } else if (daysDifference > 0 || hoursDifference > 0.5) {
        result.status = 'warning'
        result.message = `Vacation allocation exceeds requirements: ${vacationDaysCount.toFixed(1)}/${totalRequiredDays.toFixed(1)} days, ${vacationHoursCount.toFixed(1)}/${expectedHours.toFixed(1)}h`
      } else {
        result.status = 'pass'
        result.message = `✅ Vacation properly allocated: ${vacationDaysCount.toFixed(1)} days, ${vacationHoursCount.toFixed(1)}h (${plan.work_percent}% position)`
      }
    }

    return result
  }
}
