import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'
import { getNightPeriodDefinition } from '@/lib/utils/shiftTimePeriods'

/**
 * Helper to get date for a rotation
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

/**
 * Calculate overlap hours between a shift and a holiday/Sunday zone
 */
function calculateTimeZoneOverlap(
  rotation: Rotation,
  shift: Shift,
  zone: HolidayTimeZone,
  planStartDate: Date
): number {
  if (!shift.start_time || !shift.end_time) return 0

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return { h, m }
  }

  const start = parseTime(shift.start_time)
  const end = parseTime(shift.end_time)
  const isNight = end.h < start.h || (end.h === start.h && end.m < start.m)
  const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)

  let startDt: Date
  let endDt: Date

  if (isNight) {
    const prev = new Date(rotationDate)
    prev.setDate(prev.getDate() - 1)
    startDt = new Date(prev)
    startDt.setHours(start.h, start.m, 0, 0)

    endDt = new Date(rotationDate)
    endDt.setHours(end.h, end.m, 0, 0)
  } else {
    startDt = new Date(rotationDate)
    startDt.setHours(start.h, start.m, 0, 0)
    endDt = new Date(rotationDate)
    endDt.setHours(end.h, end.m, 0, 0)
  }

  const overlapStart = startDt > zone.startDateTime ? startDt : zone.startDateTime
  const overlapEnd = endDt < zone.endDateTime ? endDt : zone.endDateTime

  return overlapStart < overlapEnd
    ? (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60)
    : 0
}

/**
 * Calculate night-hour overlap inside a zone
 */
function calculateNightHoursInZone(
  rotation: Rotation,
  shift: Shift,
  zone: HolidayTimeZone,
  planStartDate: Date,
  tariffavtale: string
): number {
  if (!shift.start_time || !shift.end_time) return 0

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return { h, m }
  }

  const start = parseTime(shift.start_time)
  const end = parseTime(shift.end_time)
  const isNight = end.h < start.h || (end.h === start.h && end.m < start.m)
  const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)

  let shiftStart: Date
  let shiftEnd: Date

  if (isNight) {
    const prev = new Date(rotationDate)
    prev.setDate(prev.getDate() - 1)
    shiftStart = new Date(prev)
    shiftStart.setHours(start.h, start.m, 0, 0)
    shiftEnd = new Date(rotationDate)
    shiftEnd.setHours(end.h, end.m, 0, 0)
  } else {
    shiftStart = new Date(rotationDate)
    shiftStart.setHours(start.h, start.m, 0, 0)
    shiftEnd = new Date(rotationDate)
    shiftEnd.setHours(end.h, end.m, 0, 0)
  }

  const nightPeriod = getNightPeriodDefinition(tariffavtale)
  const nightStartToday = new Date(shiftStart)
  nightStartToday.setHours(nightPeriod.start, 0, 0, 0)
  const nightEndToday = new Date(shiftStart)
  nightEndToday.setHours(nightPeriod.end, 0, 0, 0)
  if (nightPeriod.end < nightPeriod.start) nightEndToday.setDate(nightEndToday.getDate() + 1)

  const overlapStart = new Date(Math.max(shiftStart.getTime(), zone.startDateTime.getTime(), nightStartToday.getTime()))
  const overlapEnd = new Date(Math.min(shiftEnd.getTime(), zone.endDateTime.getTime(), nightEndToday.getTime()))

  return overlapStart < overlapEnd
    ? (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60)
    : 0
}

/**
 * Generic overlay checker (used by F3/F4/F5 helpers)
 */
function checkOverlayType(
  overlayType: 'F3' | 'F4' | 'F5',
  rotations: Rotation[],
  shifts: Shift[],
  zones: HolidayTimeZone[],
  planStartDate: Date,
  tariffavtale: string
) {
  const overlays: Array<{
  type: 'F3' | 'F4' | 'F5'
  week: number
  day: number
  date: string
  underlyingShift: string
  hours: number
  overlapHolidayHours: number
  overlapNightInZone: number
}> = []
  let totalUnderlyingHours = 0
  let totalHolidayOverlapHours = 0
  let totalNightOverlapHours = 0

  rotations.forEach(rotation => {
    if (!rotation.overlay_shift_id) return
    const overlayShift = shifts.find(s => s.id === rotation.overlay_shift_id)
    if (!overlayShift || overlayShift.name !== overlayType || !overlayShift.is_default) return

    const underlyingShift = rotation.shift_id
      ? shifts.find(s => s.id === rotation.shift_id)
      : null
    if (!underlyingShift || !underlyingShift.start_time || !underlyingShift.end_time) return

    const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)
    const hours = calculateShiftHours(underlyingShift.start_time, underlyingShift.end_time)

    let zoneOverlap = 0
    let nightInZone = 0

    zones.forEach(zone => {
      const overlap = calculateTimeZoneOverlap(rotation, underlyingShift, zone, planStartDate)
      if (overlap > 0) {
        zoneOverlap += overlap
        nightInZone += calculateNightHoursInZone(rotation, underlyingShift, zone, planStartDate, tariffavtale)
      }
    })

    overlays.push({
      type: overlayType,
      week: rotation.week_index + 1,
      day: rotation.day_of_week,
      date: rotationDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' }),
      underlyingShift: underlyingShift.name,
      hours,
      overlapHolidayHours: zoneOverlap,
      overlapNightInZone: nightInZone
    })

    totalUnderlyingHours += hours
    totalHolidayOverlapHours += zoneOverlap
    totalNightOverlapHours += nightInZone
  })

  return {
    overlays,
    totals: {
      type: overlayType,
      count: overlays.length,
      totalUnderlyingHours,
      totalHolidayOverlapHours,
      totalNightOverlapHours
    }
  }
}

/**
 * Individual checkers
 */
export const checkF3Overlays = (
  rotations: Rotation[],
  shifts: Shift[],
  zones: HolidayTimeZone[],
  planStartDate: Date,
  tariffavtale: string
) => checkOverlayType('F3', rotations, shifts, zones, planStartDate, tariffavtale)

export const checkF4Overlays = (
  rotations: Rotation[],
  shifts: Shift[],
  zones: HolidayTimeZone[],
  planStartDate: Date,
  tariffavtale: string
) => checkOverlayType('F4', rotations, shifts, zones, planStartDate, tariffavtale)

export const checkF5Overlays = (
  rotations: Rotation[],
  shifts: Shift[],
  zones: HolidayTimeZone[],
  planStartDate: Date,
  tariffavtale: string
) => checkOverlayType('F5', rotations, shifts, zones, planStartDate, tariffavtale)
