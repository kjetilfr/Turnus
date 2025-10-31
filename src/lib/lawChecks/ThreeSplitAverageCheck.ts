// src/lib/lawChecks/ThreeSplitAverageCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getNightHoursCalculator, getNightHoursLabel } from '@/lib/utils/shiftTimePeriods'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'


/**
 * Three-Split Average Check (Simplified)
 *
 * Qualifications:
 *
 * For 35.5h work week, must meet ONE of:
 * 1. Average at least 1.39 hours of night work per week (20:00-06:00)
 * 2. Work every 3rd Sunday on average
 *
 * For 33.6h work week, must meet ALL of:
 * 1. Work on all hours of the day (24-hour coverage)
 * 2. Work every 3rd Sunday on average
 * 3. At least 25% of hours are non-night hours (night = tariffavtale-specific)
 *
 * Reduction rules (new):
 * - If qualifies for 33.6, compute reduction from 37.5 using:
 *    * 0.25 h reduction per tariff-night hour (15 min per hour)
 *    * (10/60) h reduction per hour worked in Sunday/red-day timezones (10 min per hour)
 * - If computed reduction < 2.0 h → apply 2.0 h reduction (so minimum goes to 35.5)
 * - Final reduced weekly hours cannot be < 33.6 (minimum)
 * - If qualifies for 35.5 but not 33.6 → max allowed weekly = 35.5 (scaled by work_percent)
 */

export const threeSplitAverageCheck: LawCheck = {
  id: 'three-split-average',
  name: '3-Delt snitt',
  description: 'Sjekker om du er kvalifisert til 3-delt snitt og/eller 35,5t/veke. Standard lagt inn er 1,39t natt (fra 20:00-06:00) per veke for å kvalifisere til 35,5 eller tredje kvar søndag (Laurdag kl. 18:00 -  Søndag kl. 22:00). For å kvalifisere til 3-delt snitt er standard 25% av timane utanom natt, vaktene må dekke heile døgnet og jobb kvar tredje søndag. ',
  category: 'shared',
  lawType: 'hta',
  lawReferences: [
    {
      title: 'HTA § 4.2.2, 4.2.3 og 4.2.4 - Arbeidstid',
      url: 'https://www.ks.no/globalassets/fagomrader/lonn-og-tariff/tariff-2024/Hovedtariffavtalen-2024-2026-interactive-120924.pdf'
    },
    {
      title: 'Ny tariffbestemmelse om ukentlig arbeidstid for tredelt skift- og turnusarbeid med virkning fra 01.01.2011',
      url: 'https://www.ks.no/contentassets/8f9b17499f234bb8b556c546272be4cc/tredelt-skift-og-turnus-b12_2010.pdf'
    },{
      title: 'Ny tariffbestemmelse om arbeidstid – utfyllende om beregning fordeltidsstillinger',
      url: 'https://www.ks.no/contentassets/8f9b17499f234bb8b556c546272be4cc/beregning-for-deltid-b-rundskrivnr-1-2011.pdf'
    },

  ],
  applicableTo: ['main', 'helping', 'year'],
  inputs: [
    {
      id: 'requiredNightHoursPerWeek',
      label: 'Timar natt for å kvalifisere til 35,5t/veke (20:00-06:00)',
      type: 'number',
      defaultValue: 1.39,
      min: 0,
      max: 24,
      step: 0.01,
      unit: 'timar/veke'
    },
    {
      id: 'requiredSundayFrequency',
      label: 'Krav til arbeidsfrekvens på søndagar (1 av X søndagar)',
      type: 'number',
      defaultValue: 3,
      min: 1,
      max: 10,
      step: 1,
      unit: 'Søndagar'
    },
    {
      id: 'requiredNonNightPercent',
      label: '3-Delt snitt prosent timar utanom natt',
      type: 'number',
      defaultValue: 25,
      min: 0,
      max: 100,
      step: 1,
      unit: '%'
    }
  ],

  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const requiredNightHours = (inputs.requiredNightHoursPerWeek as number) || 1.39
    const requiredSundayFreq = (inputs.requiredSundayFrequency as number) || 3
    const requiredNonNightPercent = (inputs.requiredNonNightPercent as number) || 25
    const effectiveRotations: Rotation[] = rotations
    const effectiveShifts: Shift[] = shifts

    const result: LawCheckResult = {
      status: 'fail',
      message: '',
      details: [],
      violations: []
    }
    console.log('🔍 Running Three-Split Average Check for plan:', plan.name, plan.id)
    console.log('Plan type:', plan.type, 'Duration weeks:', plan.duration_weeks)
    console.log('Inputs:', { requiredNightHours, requiredSundayFreq, requiredNonNightPercent })

    // Plan dates
    const planStartDate = new Date(plan.date_started)
    const planEndDate = new Date(planStartDate)
    planEndDate.setDate(planEndDate.getDate() + plan.duration_weeks * 7)

    // Build Sunday and holiday zones
    const allTimeZones: HolidayTimeZone[] = []
    allTimeZones.push(...createSundayTimeZones(planStartDate, planEndDate))

    if (plan.type === 'helping' || (plan.type === 'year' && plan.year_plan_mode !== 'rotation_based')) {
      const startYear = planStartDate.getFullYear()
      const endYear = planEndDate.getFullYear()
      for (let year = startYear; year <= endYear; year++) {
        allTimeZones.push(...getHolidayTimeZones(year))
      }
    }

    const relevantTimeZones = allTimeZones.filter(zone =>
      zone.startDateTime < planEndDate && zone.endDateTime > planStartDate
    )
    relevantTimeZones.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

    // Determine, per-zone, whether worked and hours overlapped
    const zonesWorked: Array<{
      zone: HolidayTimeZone
      overlapHours: number
      isWorked: boolean
    }> = []

    relevantTimeZones.forEach(zone => {
      let totalOverlapHours = 0

      effectiveRotations.forEach(rotation => {
        if (!rotation.shift_id) return
        const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

        const overlapHours = calculateTimeZoneOverlap(rotation, shift, zone, planStartDate)
        if (overlapHours > 0) {
          totalOverlapHours += overlapHours
        }
      })

      zonesWorked.push({
        zone,
        overlapHours: totalOverlapHours,
        isWorked: totalOverlapHours > 0
      })
    })

    // Debug: log worked zones
    console.log('\n🟥 RED DAY / SUNDAY ZONES')
    zonesWorked.forEach(zw => {
      const zoneDate = zw.zone.startDateTime.toISOString().split('T')[0]
      if (zw.isWorked && zw.overlapHours > 0) {
        console.log(
          `  ${zoneDate} | ${zw.zone.holidayName.padEnd(10)} | ${zw.overlapHours.toFixed(2)}h worked`
        )
      }
    })

    // ============================================================
    // Night hours (20:00–06:00) used for 35.5 criterion (simple)
    // ============================================================
    console.log('\n🌙 NIGHT HOURS CALCULATION (20:00–06:00 for 35.5h check)')
    let totalNightHours20to6 = 0

    effectiveRotations.forEach((rotation: Rotation) => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find((s: Shift) => s.id === rotation.shift_id)
      if (!shift || !shift.start_time || !shift.end_time) return

      const nightHours = calculateNightHours20to6(shift.start_time, shift.end_time)
      if (nightHours > 0) {
        console.log(
          `  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week}: ${shift.start_time}-${shift.end_time} → ${nightHours.toFixed(2)}h night (20–06)`
        )
      }
      totalNightHours20to6 += nightHours
    })

    const avgNightHoursPerWeek20to6 = totalNightHours20to6 / plan.duration_weeks
    console.log(`  → Average per week: ${avgNightHoursPerWeek20to6.toFixed(2)}h`)

    // ============================================================
    // Sunday frequency (robust tolerant)
    // ============================================================
    const sundayZones = zonesWorked.filter(zw =>
      zw.zone.holidayName === 'Sunday' || zw.zone.localName === 'Søndag'
    )
    const totalSundays = sundayZones.length
    const sundaysWorked = sundayZones.filter(z => z.isWorked).length

    const workedFraction = totalSundays > 0 ? sundaysWorked / totalSundays : 0
    const requiredFraction = 1 / requiredSundayFreq
    const tolerance = 0.05
    const expectedWorkedExact = totalSundays / requiredSundayFreq
    const expectedWorkedFloor = Math.max(0, Math.floor(expectedWorkedExact))

    let meetsSundayRequirement = false
    if (totalSundays === 0) {
      meetsSundayRequirement = false
    } else if (workedFraction >= Math.max(0, requiredFraction - tolerance)) {
      meetsSundayRequirement = true
    } else if (sundaysWorked >= expectedWorkedFloor) {
      meetsSundayRequirement = true
    } else {
      meetsSundayRequirement = false
    }

    const sundayWorkRatio = sundaysWorked > 0 ? totalSundays / sundaysWorked : Infinity

    // ============================================================
    // 24-hour coverage check
    // ============================================================
    const has24HourCoverage = check24HourCoverage(effectiveRotations, effectiveShifts)

    // ============================================================
    // Tariff night hours (for 33.6) and total hours
    // ============================================================
    console.log(`\n🌙 TARIFF NIGHT HOURS (${plan.tariffavtale.toUpperCase()} – ${getNightHoursLabel(plan.tariffavtale)})`)
    const calculateNightHours = getNightHoursCalculator(plan.tariffavtale)
    const nightHoursLabel = getNightHoursLabel(plan.tariffavtale)

    let totalHours = 0
    let totalNightHoursTariff = 0

    // We'll also compute totalHolidayHoursWorked: sum of overlapHours across worked holiday/Sunday zones
    const totalHolidayHoursWorked = zonesWorked
      .filter(z => z.isWorked)
      .reduce((sum, z) => sum + z.overlapHours, 0)

    effectiveRotations.forEach(rotation => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
      if (!shift || !shift.start_time || !shift.end_time) return

      const shiftHours = calculateShiftHours(shift.start_time, shift.end_time)
      const tariffNight = calculateNightHours(shift.start_time, shift.end_time)
      totalHours += shiftHours
      totalNightHoursTariff += tariffNight

      if (tariffNight > 0) {
        console.log(
          `  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week}: ${shift.start_time}-${shift.end_time} → ${tariffNight.toFixed(2)}h night (${nightHoursLabel})`
        )
      }
    })

    console.log(`  → Total tariff night hours: ${totalNightHoursTariff.toFixed(2)}h`)
    console.log(`  → Total holiday/Sunday hours worked (zones): ${totalHolidayHoursWorked.toFixed(2)}h`)

    const nonNightHours = totalHours - totalNightHoursTariff
    const nonNightPercent = totalHours > 0 ? (nonNightHours / totalHours) * 100 : 0
    const meetsNonNightRequirement = nonNightPercent >= requiredNonNightPercent

    // ============================================================
    // Qualification checks
    // ============================================================
    const meetsNightHours35 = avgNightHoursPerWeek20to6 >= requiredNightHours
    const qualifiesFor35_5 = meetsNightHours35 || meetsSundayRequirement
    const qualifiesFor33_6 = has24HourCoverage && meetsSundayRequirement && meetsNonNightRequirement

    const actualAvgHoursPerWeek = totalHours / plan.duration_weeks

    // ============================================================
    // NEW: compute reductions and expectedMaxHours according to your rules
    // ============================================================
    const workPercentFactor = plan.work_percent / 100
    const baseStandardWeek = 37.5 * workPercentFactor
    let expectedMaxHours = baseStandardWeek
    let computedReduction = 0
    let reductionFromHolidayPostPercent = 0
    let reductionFromNight = 0
    let reductionFromHoliday = 0
    let reductionFromNightTotal = 0
    let reductionFromHolidayTotal = 0
    let appliedReduction = 0
    let computedWeeklyAfterReduction = baseStandardWeek

    if (qualifiesFor33_6) {
      const weeks = plan.duration_weeks;

      reductionFromNight = totalNightHoursTariff * 0.25 / weeks // per week
      reductionFromHoliday = (totalHolidayHoursWorked * (10 / 60)) / weeks // per week

      reductionFromNightTotal = totalNightHoursTariff * 0.25
      reductionFromHolidayTotal = (totalHolidayHoursWorked * (10 / 60))

      reductionFromHolidayPostPercent = (reductionFromHoliday * workPercentFactor)

      computedReduction = reductionFromNight + reductionFromHolidayPostPercent

      // minimum reduction is 2 hours (per week)
      appliedReduction = computedReduction < 2 && computedReduction > 0 ? 2 : computedReduction

      // weekly hours after reduction
      computedWeeklyAfterReduction = baseStandardWeek - appliedReduction

      // cap minimum at 33.6h * workPercentFactor
      const minAllowed = 33.6 * workPercentFactor
      expectedMaxHours = Math.max(minAllowed, computedWeeklyAfterReduction)
    } else if (qualifiesFor35_5) {
      expectedMaxHours = 35.5 * workPercentFactor
      computedReduction = baseStandardWeek - expectedMaxHours
      reductionFromNight = totalNightHoursTariff * 0.25
      reductionFromHoliday = totalHolidayHoursWorked * (10 / 60)
      appliedReduction = computedReduction
      computedWeeklyAfterReduction = expectedMaxHours
    } else {
      // Standard week applies
      expectedMaxHours = baseStandardWeek
      computedReduction = 0
      reductionFromNight = 0
      reductionFromHoliday = 0
      appliedReduction = 0
      computedWeeklyAfterReduction = baseStandardWeek
    }

    const exceedsHourLimit = actualAvgHoursPerWeek > expectedMaxHours
    if (exceedsHourLimit) {
      // optional message
    }

    console.log('\n📊 Qualification Metrics:')
    console.log(`  Qualifies for 35.5h: ${qualifiesFor35_5}`)
    console.log(`  Qualifies for 33.6h: ${qualifiesFor33_6}`)
    console.log(`  Avg weekly hours (actual): ${actualAvgHoursPerWeek.toFixed(2)}h/week`)
    console.log(`  Computed weekly after reduction: ${computedWeeklyAfterReduction.toFixed(2)}h/week`)
    console.log(`  Expected max hours (final): ${expectedMaxHours.toFixed(2)}h/week`)
    console.log(`  Exceeds hour limit: ${exceedsHourLimit}`)

    // ============================================================
    // Prepare result details (single helper)
    // ============================================================
    const planTypeDesc = plan.type === 'helping' ? 'Helping plan' :
      plan.type === 'year' && plan.year_plan_mode !== 'rotation_based' ? 'Year plan (non-rotation)' :
      'Main plan'

    const totalRedDaysWorked = zonesWorked.filter(z => z.isWorked && z.zone.holidayName !== 'Sunday').length
    const totalHolidayZones = zonesWorked.filter(z => z.zone.holidayName !== 'Sunday').length

    // Build detailed message with calculations
    result.details = buildThreeSplitDetails({
      planTypeDesc,
      qualifiesFor33_6,
      qualifiesFor35_5,
      meetsNightHours35,
      avgNightHoursPerWeek20to6,
      requiredNightHours,
      meetsSundayRequirement,
      sundaysWorked,
      totalSundays,
      sundayWorkRatio,
      has24HourCoverage,
      meetsNonNightRequirement,
      nonNightPercent,
      requiredNonNightPercent,
      totalHours,
      totalNightHoursTariff,
      nightHoursLabel,
      totalHolidayHoursWorked,
      reductionFromNight,
      reductionFromHoliday,
      reductionFromNightTotal,
      reductionFromHolidayTotal,
      reductionFromHolidayPostPercent,
      computedReduction,
      appliedReduction,
      baseStandardWeek,
      computedWeeklyAfterReduction,
      expectedMaxHours,
      actualAvgHoursPerWeek,
      exceedsHourLimit,
      totalZonesChecked: relevantTimeZones.length,
      totalRedDaysWorked,
      totalHolidayZones,
      planDurationWeeks: plan.duration_weeks,
      planWorkPercent: plan.work_percent
    })

    // Violations and summary status
    if ((qualifiesFor33_6 || qualifiesFor35_5) && !exceedsHourLimit) {
      result.status = 'pass'
      if (qualifiesFor33_6) {
        result.message = `Timetalet i turnusen er korrekt. Kvalifiserer for 3-delt snitt med timetal på: ${expectedMaxHours.toFixed(2)}t/veke`
      } else {
        result.message = `Timetalet i turnusen er korrekt. Kvalifiserer for: ${expectedMaxHours.toFixed(2)}t/veke (35,5t x ${plan.work_percent}%). Kvalifiserer ikkje til 3-delt snitt.`
      }
    } else if ((qualifiesFor33_6 || qualifiesFor35_5) && exceedsHourLimit) {
      result.status = 'fail'
      const reduceBy = actualAvgHoursPerWeek - expectedMaxHours
      result.message = `Turnusen inneheld: ${actualAvgHoursPerWeek.toFixed(2)}t/veke, men skal innehalde: ${expectedMaxHours.toFixed(2)}t/veke. Turnusen må reduserast med ${reduceBy.toFixed(2)}t/veke.`

      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: `Turnusen inneheld: ${actualAvgHoursPerWeek.toFixed(2)}t/veke, men skal innehalde: ${expectedMaxHours.toFixed(2)}t/veke. Turnusen må reduserast med ${reduceBy.toFixed(2)}t/veke.`
      }]
    } else {
      result.status = 'fail'
      result.message = `Kvalifiserer ikkje for 35,5t/veke eller 3-delt snitt. Du vil vere kvalifisert som turnusarbeidar med 37,5t arbeidsveke.`
      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: 'Does not meet requirements for either 35.5h or 33.6h work week'
      }]
    }

    return result
  }
}

// ============================================================
// Helper Functions
// ============================================================

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
 * Build a standard detailed message showing qualification + calculations.
 * Returns array of string lines suitable for `result.details`.
 */
function buildThreeSplitDetails(params: {
  planTypeDesc: string
  qualifiesFor33_6: boolean
  qualifiesFor35_5: boolean
  meetsNightHours35: boolean
  avgNightHoursPerWeek20to6: number
  requiredNightHours: number
  meetsSundayRequirement: boolean
  sundaysWorked: number
  totalSundays: number
  sundayWorkRatio: number
  has24HourCoverage: boolean
  meetsNonNightRequirement: boolean
  nonNightPercent: number
  requiredNonNightPercent: number
  totalHours: number
  totalNightHoursTariff: number
  nightHoursLabel: string
  totalHolidayHoursWorked: number
  reductionFromNight: number        // per week credit (used for final weekly calc)
  reductionFromHoliday: number      // per week credit (used for final weekly calc)
  reductionFromNightTotal: number   // total credit (before dividing by weeks)
  reductionFromHolidayTotal: number // total credit (before dividing by weeks)
  reductionFromHolidayPostPercent: number // scaled by work_percent
  computedReduction: number
  appliedReduction: number
  baseStandardWeek: number
  computedWeeklyAfterReduction: number
  expectedMaxHours: number
  actualAvgHoursPerWeek: number
  exceedsHourLimit: boolean
  totalZonesChecked: number
  totalRedDaysWorked: number
  totalHolidayZones: number
  planDurationWeeks: number         // total number of weeks in the plan
  planWorkPercent: number           // work_percent of the plan
}) : string[] {
  const p = params

  const header = [
    `Plan type: ${p.planTypeDesc}`,
    '',
    '=== QUALIFICATION SUMMARY ===',
    p.qualifiesFor33_6 ? '✅ Qualifies for 33.6h work week' : '✗ Does NOT qualify for 33.6h work week',
    p.qualifiesFor35_5 ? '✅ Qualifies for 35.5h work week' : '✗ Does NOT qualify for 35.5h work week',
    ''
  ]

  const qualificationLogic = [
    '=== WHY (decision logic) ===',
    '33.6h requires: (1) 24-hour coverage AND (2) Sunday frequency AND (3) ≥ required non-night %',
    `  24-hour coverage: ${p.has24HourCoverage ? '✓' : '✗'}`,
    `  Sunday requirement: ${p.meetsSundayRequirement ? '✓' : '✗'} (${p.sundaysWorked}/${p.totalSundays} Sundays worked; ratio ≈ ${isFinite(p.sundayWorkRatio) ? ('1 in ' + (p.sundayWorkRatio).toFixed(2)) : 'never worked'})`,
    `  Non-night requirement: ${p.meetsNonNightRequirement ? '✓' : '✗'} (${p.nonNightPercent.toFixed(1)}% non-night, required: ≥ ${p.requiredNonNightPercent}%)`,
    '',
    '35.5h requires ONE of:',
    `  (A) night hours (20:00–06:00) ≥ required → ${p.avgNightHoursPerWeek20to6.toFixed(2)}h/week (required: ≥${p.requiredNightHours}h) → ${p.meetsNightHours35 ? '✓' : '✗'}`,
    `  (B) Sunday frequency → ${p.meetsSundayRequirement ? '✓' : '✗'}`,
    ''
  ]

const reductionSummary = [
  '=== REDUCTION CALCULATION (33.6 path) ===',
  `Base (standard) week: ${p.baseStandardWeek.toFixed(2)} h/week`,
  `Tariff night hours (used for night credit): ${p.totalNightHoursTariff.toFixed(2)} h → credit: ${p.reductionFromNightTotal.toFixed(2)} h`,
  `  → per week: ${(p.reductionFromNightTotal / p.planDurationWeeks).toFixed(2)} h/week`,
  `Holiday/Sunday zone hours worked (used for holiday credit): ${p.totalHolidayHoursWorked.toFixed(2)} h → credit: ${p.reductionFromHolidayTotal.toFixed(2)} h`,
  `  → per week: ${(p.reductionFromHolidayTotal / p.planDurationWeeks).toFixed(2)} h/week`,
  `  → scaled by work percent (${p.planWorkPercent}%): ${(p.reductionFromHolidayPostPercent).toFixed(2)} h/week`,
  `Computed reduction: ${p.computedReduction.toFixed(2)} h/week`,
  `Applied reduction (minimum 2.00 h if computed > 0): ${p.appliedReduction.toFixed(2)} h/week`,
  `Candidate weekly after reduction: ${p.computedWeeklyAfterReduction.toFixed(2)} h/week`,
  `Minimum allowed weekly (33.6 path): ${Math.max(33.6, 33.6 * (p.baseStandardWeek / 37.5)).toFixed(2)} h/week`,
  `Final allowed weekly after caps: ${p.expectedMaxHours.toFixed(2)} h/week`,
  ''
]

  const hoursSummary = [
    '=== HOURS / METRICS (raw numbers used) ===',
    `Total hours (sum of shifts across rotations): ${p.totalHours.toFixed(2)} h`,
    `Total tariff night hours (${p.nightHoursLabel}): ${p.totalNightHoursTariff.toFixed(2)} h`,
    `Non-night %: ${p.nonNightPercent.toFixed(1)}%`,
    `Avg night hours (20:00–06:00) used for 35.5h-check: ${p.avgNightHoursPerWeek20to6.toFixed(2)} h/week`,
    `Average actual hours per week: ${p.actualAvgHoursPerWeek.toFixed(2)} h/week`,
    `Allowed (final) weekly hours: ${p.expectedMaxHours.toFixed(2)} h/week`,
    `Exceeds allowed limit: ${p.exceedsHourLimit ? 'YES' : 'NO'}`,
    ''
  ]

  const zoneSummary = [
    '=== TIME ZONE / HOLIDAY CHECKS ===',
    `Total zones checked (Sundays + relevant holidays): ${p.totalZonesChecked}`,
    `Sundays worked: ${p.sundaysWorked}/${p.totalSundays}`,
    `Red days worked (non-Sunday holidays): ${p.totalRedDaysWorked}/${p.totalHolidayZones}`,
    `Holiday/Sunday hours worked (zones): ${p.totalHolidayHoursWorked.toFixed(2)} h`,
    ''
  ]

  const recommendation = [
    '=== RECOMMENDATION / NEXT ACTIONS ==='
  ]

  if (p.exceedsHourLimit) {
    recommendation.push(
      `Plan exceeds the allowed weekly hours for the qualification. Reduce by ${(p.actualAvgHoursPerWeek - p.expectedMaxHours).toFixed(2)} h/week.`
    )
  } else if (!p.qualifiesFor33_6 && !p.qualifiesFor35_5) {
    const guidance: string[] = []
    guidance.push(' • Does not qualify for reduced week. Consider increasing night hours or Sunday/holiday coverage, or restructure to achieve 24h coverage and non-night % for 33.6 path.')
    recommendation.push(...guidance)
  } else {
    recommendation.push('No corrective action required; the plan qualifies and is within the allowed weekly hours.')
  }

  // Combine and return
  return [
    ...header,
    ...qualificationLogic,
    ...reductionSummary,
    ...hoursSummary,
    ...zoneSummary,
    ...recommendation
  ]
}

/**
 * Calculate overlap between a rotation/shift and a time zone
 */
function calculateTimeZoneOverlap(
  rotation: Rotation,
  shift: Shift,
  zone: HolidayTimeZone,
  planStartDate: Date
): number {
  if (!shift.start_time || !shift.end_time) return 0

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

  // Calculate overlap
  const overlapStart = shiftStartDateTime > zone.startDateTime
    ? shiftStartDateTime
    : zone.startDateTime

  const overlapEnd = shiftEndDateTime < zone.endDateTime
    ? shiftEndDateTime
    : zone.endDateTime

  if (overlapStart < overlapEnd) {
    const overlapMillis = overlapEnd.getTime() - overlapStart.getTime()
    return overlapMillis / (1000 * 60 * 60)
  }

  return 0
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

/**
 * Calculate night hours for 20:00-06:00 period (35.5h qualification)
 */
function calculateNightHours20to6(startTime: string, endTime: string): number {
  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const startMinutes = parseTime(startTime)
  let endMinutes = parseTime(endTime)

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const nightStart = 20 * 60 // 20:00
  const midnight = 24 * 60
  const nightEndAfterMidnight = 6 * 60 // 06:00

  let nightHours = 0

  // Period 1: 20:00 to midnight
  const period1Start = Math.max(startMinutes, nightStart)
  const period1End = Math.min(endMinutes, midnight)
  if (period1Start < period1End) {
    nightHours += (period1End - period1Start) / 60
  }

  // Period 2: midnight to 06:00
  if (endMinutes > midnight) {
    const period2Start = Math.max(startMinutes, midnight)
    const period2End = Math.min(endMinutes, midnight + nightEndAfterMidnight)
    if (period2Start < period2End) {
      nightHours += (period2End - period2Start) / 60
    }
  }

  return nightHours
}

/**
 * Check 24-hour coverage
 */
function check24HourCoverage(rotations: Rotation[], shifts: Shift[]): boolean {
  const timeRanges: Array<{ start: number; end: number }> = []

  rotations.forEach((rotation: Rotation) => {
    if (rotation.shift_id) {
      const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
      if (shift && shift.start_time && shift.end_time) {
        const parseTime = (time: string) => {
          const [h, m] = time.split(':').map(Number)
          return h * 60 + m
        }

        const startMinutes = parseTime(shift.start_time)
        const endMinutes = parseTime(shift.end_time)

        if (endMinutes < startMinutes) {
          // Night shift - split into two ranges
          timeRanges.push({ start: startMinutes, end: 24 * 60 })
          timeRanges.push({ start: 0, end: endMinutes })
        } else {
          timeRanges.push({ start: startMinutes, end: endMinutes })
        }
      }
    }
  })

  if (timeRanges.length === 0) return false

  // Sort and merge overlapping ranges
  timeRanges.sort((a, b) => a.start - b.start)
  const mergedRanges: Array<{ start: number; end: number }> = [timeRanges[0]]

  for (let i = 1; i < timeRanges.length; i++) {
    const current = timeRanges[i]
    const last = mergedRanges[mergedRanges.length - 1]

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      return false // Gap found
    }
  }

  return mergedRanges.length === 1 &&
    mergedRanges[0].start === 0 &&
    mergedRanges[0].end === 24 * 60
}
