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
  applicableTo: ['main', 'helping', 'year'],
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
        return {
          status: 'warning',
          message: 'Base plan data not available',
          details: ['Helping plans require base plan for F5 check']
        }
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
      return {
        status: 'warning',
        message: 'Required shift(s) missing',
        details: [`F1 found: ${!!f1Shift}, F5 found: ${!!f5Shift}`]
      }
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

    console.log(`🟩 Found ${f5Rotations.length} F5 shift instance(s) in helping plan:`)
    f5Rotations.forEach(r =>
      console.log(`  → Week ${r.rotation.week_index + 1}, Day ${r.rotation.day_of_week}, Date: ${formatDateLocal(r.date)}`)
    )

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
      replacedShift?: Rotation
      f5Present: boolean
    }> = []

    f1Rotations.forEach(f1Rotation => {
      const f1Date = getRotationDate(f1StartDate, f1Rotation.week_index, f1Rotation.day_of_week)
      const holidayOnF1 = allHolidays.find(h => formatDateLocal(h.date) === formatDateLocal(f1Date))
      if (!holidayOnF1) return

      // Check if any F5 exists in helping plan
      const f5Present = f5Rotations.length > 0

      // Check if F5 replaces a shift from base plan (offset week mapping)
      let replacedShift: Rotation | undefined
      if (plan.type === 'helping') {
        const baseWeekLength = Math.max(...basePlanRotations!.map(r => r.week_index)) + 1
        const effectiveWeekIndex = (f1Rotation.week_index - weekOffset + baseWeekLength) % baseWeekLength
        replacedShift = rotationsToCheck.find(r => r.week_index === effectiveWeekIndex && r.shift_id !== f5Shift!.id)
      }

      casesNeedingF5.push({ f1Date, holidayName: holidayOnF1.localName, f5Present, replacedShift })
    })

    // --- Check total hours reduction ---
    let baseHours = 0
    let helpingHours = 0

    if (plan.type === 'helping') {
      // Compare hours for same number of weeks
      const baseWeekLength = Math.max(...basePlanRotations!.map(r => r.week_index)) + 1
      for (let week = 0; week < planDurationWeeks; week++) {
        const baseWeek = (week + weekOffset) % baseWeekLength
        const baseWeekRotations = basePlanRotations!.filter(r => r.week_index === baseWeek)
        const helpingWeekRotations = rotationsToCheck.filter(r => r.week_index === week)

        baseWeekRotations.forEach(r => {
          const shift = basePlanShifts!.find(s => s.id === r.shift_id)
          if (shift) baseHours += calculateShiftHours(shift.start_time, shift.end_time)
        })
        helpingWeekRotations.forEach(r => {
          const shift = shifts.find(s => s.id === r.shift_id)
          if (shift) helpingHours += calculateShiftHours(shift.start_time, shift.end_time)
        })
      }
    }

    // --- Build results ---
    const missingF5 = casesNeedingF5.filter(c => !c.f5Present)
    missingF5.forEach(c => {
      result.details?.push(`⚠️ No F5 shift found for ${c.holidayName} (${formatDateLocal(c.f1Date)})`)
      result.violations?.push({ weekIndex: 0, dayOfWeek: 0, description: `Missing F5: ${c.holidayName}` })
    })

    casesNeedingF5.forEach(c => {
      if (c.f5Present && !c.replacedShift) {
        result.details?.push(`⚠️ F5 shift does not replace any base shift for ${c.holidayName}`)
        result.violations?.push({ weekIndex: 0, dayOfWeek: 0, description: `F5 not replacing base shift: ${c.holidayName}` })
      }
    })

    if (plan.type === 'helping' && helpingHours >= baseHours) {
      result.details?.push(`⚠️ Total hours in helping plan (${helpingHours}) not reduced vs base plan (${baseHours})`)
      result.violations?.push({ weekIndex: 0, dayOfWeek: 0, description: 'Total hours not reduced by F5' })
    }

    if (result.violations && result.violations.length > 0) {
      result.status = 'warning'
      result.message = `⚠️ ${result.violations.length} issues found for F5 replacement days`
    } else {
      result.status = 'pass'
      result.message = `✅ All F1 holidays are properly covered with F5 shifts and total hours reduced`
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
