// src/lib/lawChecks/F5ReplacementDayCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'

export const f5ReplacementDayCheck: LawCheck = {
  id: 'f5-replacement-day',
  name: 'F5 Erstatningsfridag',
  description: 'Dersom F1 dagen din er på ein raud dag har du rett på F5. F5 dagen din kan bli utbetalt i staden for å plasserast i turnus. Utbetaling er lik ei dagslønn. (Grunnlag basert på grunnturnus eller rullerande årsturnus)',
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

      rotationsToCheck = rotations
      shiftsToCheck = shifts

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
    
    // Get holiday timezones instead of just dates
    const allHolidayZones: HolidayTimeZone[] = []
    for (let year = startYear; year <= endYear; year++) {
      getHolidayTimeZones(year).forEach(zone => {
        if (zone.startDateTime < planEndDate && zone.endDateTime >= planStartDate) {
          allHolidayZones.push(zone)
        }
      })
    }
    
    // Also create Sunday timezones
    const sundayZones = createSundayTimeZones(planStartDate, planEndDate)
    const allTimeZones = [...allHolidayZones, ...sundayZones]
    
    // Collect actual holiday dates (not Sunday zones) for F1 checking
    const allHolidays = allHolidayZones.map(zone => ({
      date: new Date(zone.endDateTime),
      name: zone.holidayName,
      localName: zone.localName
    }))

    // --- Prepare F5 rotations in helping plan ---
    const f5Rotations = rotationsToCheck
      .filter(r => {
        // Check both regular shift_id and overlay_shift_id
        if (r.shift_id === f5Shift!.id) return true
        if (r.overlay_shift_id === f5Shift!.id && r.overlay_type === 'f5_replacement') return true
        return false
      })
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
      `Total holiday/Sunday timezones: ${allTimeZones.length}`,
      `Total F1 shifts: ${f1Rotations.length}`,
      `Total F5 replacement shifts: ${f5Rotations.length}`,
      ''
    )

    // --- Check F1 on holiday ---
    const casesNeedingF5: Array<{
      f1Date: Date
      holidayName: string
    }> = []

    f1Rotations.forEach(f1Rotation => {
      const f1Date = getRotationDate(f1StartDate, f1Rotation.week_index, f1Rotation.day_of_week)
      const holidayOnF1 = allHolidays.find(h => formatDateLocal(h.date) === formatDateLocal(f1Date))
      if (!holidayOnF1) return

      casesNeedingF5.push({ 
        f1Date, 
        holidayName: holidayOnF1.localName
      })
    })

    // --- Build results ---
    result.details.push('--- F1 on Holidays Analysis ---')
    
    casesNeedingF5.forEach(c => {
      const dateStr = formatDateLocal(c.f1Date)
      result.details?.push(`  ${c.holidayName} (${dateStr})`)
    })
    
    result.details?.push('')
    result.details?.push(`Total F1s on holidays requiring F5: ${casesNeedingF5.length}`)

    // --- Validate F5 placement ---
    let validF5Count = 0
    
    result.details?.push('')
    result.details?.push('--- F5 Replacement Shift Validation ---')
    
    // Check if F5s are properly placed as replacement shifts without overlapping red day timezones
    if (plan.type === 'helping' && basePlanRotations && basePlanShifts) {
      const baseWeekLength = Math.max(...basePlanRotations.map(r => r.week_index)) + 1
      
      f5Rotations.forEach(f5r => {
        // Get the base shift that F5 is replacing
        const baseWeek = (f5r.rotation.week_index + weekOffset) % baseWeekLength
        const baseWeekRotations = basePlanRotations.filter(r => r.week_index === baseWeek)
        
        const replacedBaseRotation = baseWeekRotations.find(r => 
          r.day_of_week === f5r.rotation.day_of_week && r.shift_id
        )
        
        if (!replacedBaseRotation) {
          result.details?.push(`  ❌ Week ${f5r.rotation.week_index + 1}, ${getDayName(f5r.date)}: F5 on empty day (no shift to replace)`)
          result.violations?.push({ 
            weekIndex: f5r.rotation.week_index, 
            dayOfWeek: f5r.rotation.day_of_week, 
            description: `F5 placed on day without base shift to replace` 
          })
          return
        }
        
        const baseShift = basePlanShifts.find(s => s.id === replacedBaseRotation.shift_id)
        if (baseShift?.is_default) {
          result.details?.push(`  ❌ Week ${f5r.rotation.week_index + 1}, ${getDayName(f5r.date)}: F5 replaces ${baseShift.name} instead of work shift`)
          result.violations?.push({ 
            weekIndex: f5r.rotation.week_index, 
            dayOfWeek: f5r.rotation.day_of_week, 
            description: `F5 replaces ${baseShift.name} instead of work shift` 
          })
          return
        }
        
        // Check if the shift overlaps with any red day timezone
        if (baseShift && baseShift.start_time && baseShift.end_time) {
          const overlap = calculateAnyTimeZoneOverlap(
            f5r.rotation,
            baseShift,
            allTimeZones,
            planStartDate
          )
          
          if (overlap.hasOverlap) {
            // Check if this is the allowed exception: Saturday before normal Sunday
            const isAllowedException = checkIfSaturdayBeforeNormalSunday(
              f5r.date,
              allTimeZones
            )
            
            if (isAllowedException) {
              result.details?.push(`  ✅ Week ${f5r.rotation.week_index + 1}, ${getDayName(f5r.date)}: F5 replaces ${baseShift?.name || 'work shift'} (exception: Saturday before normal Sunday)`)
              validF5Count++
            } else {
              result.details?.push(`  ❌ Week ${f5r.rotation.week_index + 1}, ${getDayName(f5r.date)}: F5 shift overlaps with ${overlap.zoneName} timezone`)
              result.violations?.push({ 
                weekIndex: f5r.rotation.week_index, 
                dayOfWeek: f5r.rotation.day_of_week, 
                description: `F5 shift overlaps with ${overlap.zoneName} timezone` 
              })
            }
          } else {
            result.details?.push(`  ✅ Week ${f5r.rotation.week_index + 1}, ${getDayName(f5r.date)}: F5 replaces ${baseShift?.name || 'work shift'}`)
            validF5Count++
          }
        }
      })
      
      result.details?.push('')
      result.details?.push(`Valid F5 replacement shifts: ${validF5Count}`)
      
      if (casesNeedingF5.length > 0) {
        if (validF5Count < casesNeedingF5.length) {
          result.details?.push(`❌ Insufficient F5s: Need ${casesNeedingF5.length}, have ${validF5Count}`)
          result.violations?.push({
            weekIndex: 0,
            dayOfWeek: 0,
            description: `Need ${casesNeedingF5.length} F5 replacement shifts for holidays, but only ${validF5Count} valid F5s found`
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
      result.message = `✅ All ${casesNeedingF5.length} F1-on-holiday case(s) properly covered with F5 replacement shifts`
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

function getDayName(date: Date): string {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const jsDay = date.getDay()
  const mondayFirstIndex = (jsDay + 6) % 7
  return days[mondayFirstIndex]
}

/**
 * Check if a shift overlaps with any red day timezone
 */
function calculateAnyTimeZoneOverlap(
  rotation: Rotation,
  shift: Shift,
  zones: HolidayTimeZone[],
  planStartDate: Date
): { hasOverlap: boolean; zoneName: string } {
  if (!shift.start_time || !shift.end_time) {
    return { hasOverlap: false, zoneName: '' }
  }

  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return { hour: h, minute: m }
  }

  const startTime = parseTime(shift.start_time)
  const endTime = parseTime(shift.end_time)

  const isNightShift =
    endTime.hour < startTime.hour ||
    (endTime.hour === startTime.hour && endTime.minute < startTime.minute)

  const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)

  let shiftStartDateTime: Date
  let shiftEndDateTime: Date

  if (rotation.day_of_week === 6 && isNightShift) {
    // Sunday night shift - starts Saturday
    const saturday = new Date(rotationDate)
    saturday.setDate(saturday.getDate() - 1)

    shiftStartDateTime = new Date(saturday)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else if (isNightShift) {
    // Regular night shift
    const prevDay = new Date(rotationDate)
    prevDay.setDate(prevDay.getDate() - 1)

    shiftStartDateTime = new Date(prevDay)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else {
    // Day shift
    shiftStartDateTime = new Date(rotationDate)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  }

  // Check if shift overlaps with any timezone
  for (const zone of zones) {
    const overlapStart = shiftStartDateTime > zone.startDateTime
      ? shiftStartDateTime
      : zone.startDateTime

    const overlapEnd = shiftEndDateTime < zone.endDateTime
      ? shiftEndDateTime
      : zone.endDateTime

    if (overlapStart < overlapEnd) {
      return { hasOverlap: true, zoneName: zone.localName }
    }
  }

  return { hasOverlap: false, zoneName: '' }
}

/**
 * Create Sunday time zones (Saturday 18:00 - Sunday 22:00)
 */
function createSundayTimeZones(startDate: Date, endDate: Date): HolidayTimeZone[] {
  const zones: HolidayTimeZone[] = []
  const current = new Date(startDate)

  // Move to first Sunday on/after startDate
  while (current.getDay() !== 0) {
    current.setDate(current.getDate() + 1)
  }

  while (current <= endDate) {
    const sunday = new Date(current)
    const saturday = new Date(current)
    saturday.setDate(saturday.getDate() - 1)

    const zoneStart = new Date(saturday)
    zoneStart.setHours(18, 0, 0, 0)

    const zoneEnd = new Date(sunday)
    zoneEnd.setHours(22, 0, 0, 0)

    if (zoneEnd >= startDate && zoneStart <= endDate) {
      zones.push({
        holidayName: 'Sunday',
        localName: 'Søndag',
        startDateTime: zoneStart,
        endDateTime: zoneEnd,
        type: 'standard'
      })
    }

    current.setDate(current.getDate() + 7)
  }

  return zones
}

/**
 * Check if a date is Saturday before a normal Sunday (not a holiday Sunday)
 * This is allowed for F5 placement
 */
function checkIfSaturdayBeforeNormalSunday(
  date: Date,
  allTimeZones: HolidayTimeZone[]
): boolean {
  // Check if it's a Saturday
  if (date.getDay() !== 6) return false
  
  // Get the Sunday after this Saturday
  const sunday = new Date(date)
  sunday.setDate(sunday.getDate() + 1)
  const sundayStr = formatDateLocal(sunday)
  
  // Check if that Sunday is a holiday (not just a normal Sunday)
  const sundayIsHoliday = allTimeZones.some(zone => {
    // Only check non-standard Sunday zones (i.e., actual holidays)
    if (zone.type === 'standard' && zone.holidayName === 'Sunday') {
      return false
    }
    const zoneEndDate = formatDateLocal(new Date(zone.endDateTime))
    return zoneEndDate === sundayStr
  })
  
  // If Sunday is NOT a holiday, then this Saturday is allowed
  return !sundayIsHoliday
}