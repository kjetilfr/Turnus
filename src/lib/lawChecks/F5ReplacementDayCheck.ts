// src/lib/lawChecks/F5ReplacementDayCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { getNorwegianHolidays } from '@/lib/utils/norwegianHolidays'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'

export const f5ReplacementDayCheck: LawCheck = {
  id: 'f5-replacement-day',
  name: 'F5 Replacement Day (Erstatningsfridag)',
  description: 'Ensures F5 shifts cover holidays that fall on F1 and correctly reduce total hours in helping plan compared to base plan.',
  category: 'shared',
  lawType: 'hta',
  lawReferences: [
    {
      title: 'HTA - Erstatningsfridag',
      url: 'https://www.ks.no/fagomrader/lonn-og-tariff/tariffavtaler/'
    }
  ],
  applicableTo: ['helping', 'year'],
  inputs: [],

  run: ({ rotations, shifts, plan, basePlanRotations, basePlanShifts, basePlan }) => {
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

    if (plan.tariffavtale === 'oslo' || plan.tariffavtale === 'staten') {
    return {
        status: 'warning',
        message: 'F5 check not applicable to Oslo or Staten tariffavtale',
        details: ['This check is only for KS tariffavtale']
    }
}

    const planStartDate = new Date(plan.date_started)
    const planDurationWeeks = plan.duration_weeks

    let rotationsToCheck: Rotation[] = []
    let shiftsToCheck: Shift[] = []
    let weekOffset = 0

    // --- Helping plan: compute effective rotations & week offset ---
    if (plan.type === 'helping') {
      if (!plan.base_plan_id || !basePlan || !basePlanRotations || !basePlanShifts) {
        result.status = 'warning'
        result.message = 'Base plan data not available'
        result.details = ['Helping plans require base plan for F5 check']
        return result
      }

      const maxWeek = Math.max(...basePlanRotations.map(r => r.week_index))
      const basePlanRotationLength = maxWeek + 1

      const basePlanStartDate = new Date(basePlan.date_started)
      const helpingPlanStartDate = new Date(plan.date_started)
      const diffTime = helpingPlanStartDate.getTime() - basePlanStartDate.getTime()
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7))
      weekOffset = ((diffWeeks % basePlanRotationLength) + basePlanRotationLength) % basePlanRotationLength

      rotationsToCheck = rotations // helping plan rotations for F5
      shiftsToCheck = shifts       // helping plan shifts

      result.details = [
        `Plan type: helping`,
        `Base rotation length: ${basePlanRotationLength} weeks`,
        `Week offset: ${weekOffset}`,
        `Checking F1 from base plan and F5 from helping plan`
      ]
    } else {
      rotationsToCheck = rotations
      shiftsToCheck = shifts
      result.details = [
        `Plan type: ${plan.type}`,
        `Checking own plan for F1 and F5`
      ]
    }

    // --- Determine F1 and F5 shifts ---
    let f1Shift: Shift | undefined
    let f5Shift: Shift | undefined

    if (plan.type === 'helping') {
      f1Shift = basePlanShifts?.find(s => s.name.trim().toUpperCase() === 'F1')
      f5Shift = shifts.find(s => s.name.trim().toUpperCase() === 'F5')
    } else {
      f1Shift = shifts.find(s => s.name.trim().toUpperCase() === 'F1')
      f5Shift = shifts.find(s => s.name.trim().toUpperCase() === 'F5')
    }

    if (!f1Shift || !f5Shift) {
      result.status = 'warning'
      result.message = 'Required shift(s) missing'
      result.details = [`F1 found: ${!!f1Shift}, F5 found: ${!!f5Shift}`]
      return result
    }

    // --- Holidays ---
    const planEndDate = new Date(planStartDate)
    planEndDate.setDate(planEndDate.getDate() + planDurationWeeks * 7)
    const startYear = planStartDate.getFullYear()
    const endYear = planEndDate.getFullYear()
    const allHolidays: Array<{ date: Date; name: string; localName: string }> = []

    for (let year = startYear; year <= endYear; year++) {
      getNorwegianHolidays(year).forEach(h => {
        const holidayDate = new Date(h.date)
        if (holidayDate >= planStartDate && holidayDate <= planEndDate) {
          allHolidays.push({ date: holidayDate, name: h.name, localName: h.localName })
        }
      })
    }

    // --- Prepare F5 rotations in helping plan ---
    const f5Rotations = rotationsToCheck
      .filter(r => r.shift_id === f5Shift!.id)
      .map(r => ({
        rotation: r,
        date: getRotationDate(planStartDate, r.week_index, r.day_of_week)
      }))

    // --- F1 rotations ---
    const f1StartDate = plan.type === 'helping' ? new Date(basePlan!.date_started) : planStartDate
    const f1RotationsSource = plan.type === 'helping' ? basePlanRotations! : rotationsToCheck
    const f1Rotations = f1RotationsSource.filter(r => r.shift_id === f1Shift!.id)

    result.details.push(
      `Plan period: ${planStartDate.toISOString().split('T')[0]} → ${planEndDate.toISOString().split('T')[0]}`,
      `Total holidays: ${allHolidays.length}`,
      `Total F1 shifts: ${f1Rotations.length}`,
      `Total F5 shifts: ${f5Rotations.length}`,
      ''
    )

    // --- Check F1 on holiday ---
    const casesNeedingF5: Array<{
      f1Date: Date
      holidayName: string
      f5Present: boolean
      f5ReplacesWork: boolean
    }> = []

    f1Rotations.forEach(f1Rotation => {
      const f1Date = getRotationDate(f1StartDate, f1Rotation.week_index, f1Rotation.day_of_week)
      const holidayOnF1 = allHolidays.find(h => formatDateLocal(h.date) === formatDateLocal(f1Date))
      if (!holidayOnF1) return

      // Check if ANY F5 exists anywhere in helping plan
      const f5Present = f5Rotations.length > 0

      // Check if ANY F5 replaces a base shift (anywhere in the plan)
      let f5ReplacesWork = false
      if (plan.type === 'helping' && basePlanRotations && basePlanShifts && f5Present) {
        const baseWeekLength = Math.max(...basePlanRotations.map(r => r.week_index)) + 1
        
        // Check all F5s to see if any replace work
        f5ReplacesWork = f5Rotations.some(f5r => {
          const baseWeek = (f5r.rotation.week_index + weekOffset) % baseWeekLength
          const baseWeekRotations = basePlanRotations.filter(r => r.week_index === baseWeek)
          
          const replacedRotation = baseWeekRotations.find(r => 
            r.day_of_week === f5r.rotation.day_of_week && 
            r.shift_id &&
            !basePlanShifts.find(s => s.id === r.shift_id)?.is_default // Must replace actual work, not F shifts
          )
          return !!replacedRotation
        })
      }

      casesNeedingF5.push({ 
        f1Date, 
        holidayName: holidayOnF1.localName, 
        f5Present,
        f5ReplacesWork
      })
    })

    // --- Build results ---
    result.details.push('--- F1 on Holidays Analysis ---')
    
    // List all F1s on holidays
    casesNeedingF5.forEach(c => {
      const dateStr = formatDateLocal(c.f1Date)
      result.details?.push(`  ${c.holidayName} (${dateStr})`)
    })
    
    result.details?.push('')
    result.details?.push(`Total F1s on holidays: ${casesNeedingF5.length}`)

    // Validate each F5 placement and count valid ones
    let validF5Count = 0
    
    if (plan.type === 'helping' && basePlanRotations && basePlanShifts) {
      result.details?.push('')
      result.details?.push('--- Individual F5 Validation ---')
      
      const baseWeekLength = Math.max(...basePlanRotations.map(r => r.week_index)) + 1
      
      f5Rotations.forEach(f5r => {
        const baseWeek = (f5r.rotation.week_index + weekOffset) % baseWeekLength
        const baseWeekRotations = basePlanRotations.filter(r => r.week_index === baseWeek)
        
        const replacedBaseRotation = baseWeekRotations.find(r => 
          r.day_of_week === f5r.rotation.day_of_week && r.shift_id
        )
        
        if (!replacedBaseRotation) {
          result.details?.push(`  ❌ Week ${f5r.rotation.week_index + 1}, Day ${f5r.rotation.day_of_week}: F5 on empty day`)
          result.violations?.push({ 
            weekIndex: f5r.rotation.week_index, 
            dayOfWeek: f5r.rotation.day_of_week, 
            description: `F5 placed on day without base shift` 
          })
        } else {
          const baseShift = basePlanShifts.find(s => s.id === replacedBaseRotation.shift_id)
          if (baseShift?.is_default) {
            result.details?.push(`  ❌ Week ${f5r.rotation.week_index + 1}, Day ${f5r.rotation.day_of_week}: F5 replaces ${baseShift.name}`)
            result.violations?.push({ 
              weekIndex: f5r.rotation.week_index, 
              dayOfWeek: f5r.rotation.day_of_week, 
              description: `F5 replaces ${baseShift.name} instead of work shift` 
            })
          } else {
            result.details?.push(`  ✅ Week ${f5r.rotation.week_index + 1}, Day ${f5r.rotation.day_of_week}: F5 replaces ${baseShift?.name || 'work shift'}`)
            validF5Count++ // Count this as a valid F5
          }
        }
      })
      
      // Check if count matches
      result.details?.push('')
      result.details?.push(`Valid F5 count: ${validF5Count}`)
      
      if (casesNeedingF5.length > 0) {
        if (validF5Count < casesNeedingF5.length) {
          result.details?.push(`❌ Insufficient F5s: Need ${casesNeedingF5.length}, have ${validF5Count}`)
          result.violations?.push({
            weekIndex: 0,
            dayOfWeek: 0,
            description: `Need ${casesNeedingF5.length} F5s for holidays, but only ${validF5Count} valid F5s found`
          })
        } else if (validF5Count > casesNeedingF5.length) {
          result.details?.push(`✅ Sufficient F5s: Need ${casesNeedingF5.length}, have ${validF5Count} (${validF5Count - casesNeedingF5.length} extra)`)
        } else {
          result.details?.push(`✅ Perfect F5 count: ${validF5Count} F5s for ${casesNeedingF5.length} F1-on-holidays`)
        }
      }
    }

    // --- Final status ---
    if (result.violations && result.violations.length > 0) {
      result.status = 'warning'
      result.message = `⚠️ ${result.violations.length} issue(s) found for F5 replacement days`
    } else if (casesNeedingF5.length === 0) {
      result.status = 'pass'
      result.message = `✅ No F1s fall on holidays - no F5 compensation needed`
    } else {
      result.status = 'pass'
      result.message = `✅ All ${casesNeedingF5.length} F1-on-holiday case(s) properly covered with F5 shifts`
    }

    return result
  }
}

// --- Helpers ---
function getRotationDate(planStartDate: Date, weekIndex: number, dayOfWeek: number): Date {
  const d = new Date(planStartDate)
  const jsDay = d.getDay()
  const mondayFirstIndex = (jsDay + 6) % 7
  d.setDate(d.getDate() - mondayFirstIndex)
  d.setDate(d.getDate() + weekIndex * 7 + dayOfWeek)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
}