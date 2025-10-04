// src/lib/lawChecks/CompensatingRestCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'

/**
 * Kompenserande kvile (Compensating Rest Period)
 * Checks that shortened rest periods are properly compensated in the following rest period
 */
export const compensatingRestCheck: LawCheck = {
  id: 'compensating-rest',
  name: 'Kompenserande kvile (Compensating Rest Period)',
  description: 'Verifies that if rest between shifts is shorter than the minimum (default 11h), the shortfall must be compensated in the next rest period. Example: 8h rest requires next rest to be 11h + 3h = 14h.',
  category: 'shared',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'AML §10-8 (1) - Kompenserende hvile',
      url: 'hhttps://lovdata.no/lov/2005-06-17-62/§10-8'
    },
    {
      title: 'AML §10-8 (3) - Kompenserende hvile',
      url: 'hhttps://lovdata.no/lov/2005-06-17-62/§10-8'
    }
  ],
  applicableTo: ['main', 'helping', 'year'],
  inputs: [
    {
      id: 'minShiftRestHours',
      label: 'Minimum Rest Period',
      type: 'number',
      defaultValue: 11,
      min: 1,
      max: 24,
      step: 0.5,
      unit: 'hours'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const minRestHours = (inputs.minRestHours as number) || 11

    // Build a chronological list of all shifts
    const shiftsWithTimes: Array<{
      weekIndex: number
      dayOfWeek: number
      shiftName: string
      startDateTime: Date
      endDateTime: Date
    }> = []

    const planStartDate = new Date(plan.date_started)

    rotations.forEach((rotation) => {
      if (rotation.shift_id) {
        const shift = shifts.find((s) => s.id === rotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const daysFromStart = rotation.week_index * 7 + rotation.day_of_week
          const shiftDate = new Date(planStartDate)
          shiftDate.setDate(shiftDate.getDate() + daysFromStart)

          const [startHour, startMin] = shift.start_time.split(':').map(Number)
          const [endHour, endMin] = shift.end_time.split(':').map(Number)

          const startDateTime = new Date(shiftDate)
          startDateTime.setHours(startHour, startMin, 0, 0)

          const endDateTime = new Date(shiftDate)
          endDateTime.setHours(endHour, endMin, 0, 0)

          const startMinutes = startHour * 60 + startMin
          const endMinutes = endHour * 60 + endMin

          if (endMinutes < startMinutes) {
            endDateTime.setDate(endDateTime.getDate() + 1)
          }

          shiftsWithTimes.push({
            weekIndex: rotation.week_index,
            dayOfWeek: rotation.day_of_week,
            shiftName: shift.name,
            startDateTime,
            endDateTime
          })
        }
      }
    })

    shiftsWithTimes.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

    if (shiftsWithTimes.length < 2) {
      return {
        status: 'pass',
        message: 'Not enough shifts to check rest periods',
        details: ['At least 2 shifts are required to check rest periods']
      }
    }

    let compensationDebt = 0
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const violations: string[] = []
    const detailsList: string[] = []

    for (let i = 0; i < shiftsWithTimes.length - 1; i++) {
      const currentShift = shiftsWithTimes[i]
      const nextShift = shiftsWithTimes[i + 1]

      const restMillis = nextShift.startDateTime.getTime() - currentShift.endDateTime.getTime()
      const restHours = restMillis / (1000 * 60 * 60)
      const requiredRest = minRestHours + compensationDebt

      const fromLabel = `Week ${currentShift.weekIndex + 1}, ${dayNames[currentShift.dayOfWeek]} (${currentShift.shiftName})`
      const toLabel = `Week ${nextShift.weekIndex + 1}, ${dayNames[nextShift.dayOfWeek]} (${nextShift.shiftName})`

      if (restHours < minRestHours) {
        const shortfall = minRestHours - restHours
        compensationDebt += shortfall

        detailsList.push(
          `${fromLabel} → ${toLabel}: Rest ${restHours.toFixed(1)}h is ${shortfall.toFixed(1)}h short. Debt now: ${compensationDebt.toFixed(1)}h`
        )
      } else if (compensationDebt > 0) {
        if (restHours >= requiredRest) {
          detailsList.push(
            `${fromLabel} → ${toLabel}: Rest ${restHours.toFixed(1)}h compensates ${compensationDebt.toFixed(1)}h debt. ✓ Debt cleared`
          )
          compensationDebt = 0
        } else {
          const missingCompensation = requiredRest - restHours

          violations.push(
            `${fromLabel} → ${toLabel}: Rest ${restHours.toFixed(1)}h insufficient. Required ${requiredRest.toFixed(1)}h. Missing ${missingCompensation.toFixed(1)}h`
          )

          const compensated = Math.max(0, restHours - minRestHours)
          compensationDebt -= compensated

          detailsList.push(
            `${fromLabel} → ${toLabel}: Partial compensation. Remaining debt: ${compensationDebt.toFixed(1)}h`
          )
        }
      } else {
        detailsList.push(
          `${fromLabel} → ${toLabel}: Rest ${restHours.toFixed(1)}h meets ${minRestHours}h minimum ✓`
        )
      }
    }

    if (compensationDebt > 0) {
      const lastShift = shiftsWithTimes[shiftsWithTimes.length - 1]
      violations.push(
        `End of schedule: Uncompensated debt of ${compensationDebt.toFixed(1)}h remains`
      )
    }

    const result: LawCheckResult = {
      status: violations.length > 0 ? 'fail' : 'pass',
      message: violations.length > 0 
        ? `Found ${violations.length} compensating rest violation${violations.length !== 1 ? 's' : ''}`
        : `All rest periods comply with ${minRestHours}h minimum and compensation requirements`,
      details: [
        `Minimum rest period: ${minRestHours}h`,
        `Total shifts: ${shiftsWithTimes.length}`,
        `Rest periods checked: ${shiftsWithTimes.length - 1}`,
        '',
        ...(violations.length > 0 ? ['❌ Violations:', ...violations.map(v => `  ${v}`), ''] : []),
        'Rest period details:',
        ...detailsList.map(d => `  ${d}`)
      ],
      violations: violations.length > 0 ? violations.map(() => ({
        weekIndex: 0,
        dayOfWeek: 0,
        description: 'Rest period violation'
      })) : []
    }

    return result
  }
}