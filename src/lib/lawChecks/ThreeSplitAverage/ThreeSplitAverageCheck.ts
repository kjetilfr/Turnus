// src/lib/lawChecks/ThreeSplitAverageCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getNightHoursCalculator, getNightHoursLabel } from '@/lib/utils/shiftTimePeriods'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'
import { qualifiesFor35h } from '@/lib/lawChecks/ThreeSplitAverage/ThreeSplitAverage355Check'
import { checkF3Overlays, checkF4Overlays, checkF5Overlays } from '@/lib/lawChecks/ThreeSplitAverage/ThreeSplitAverageFCheck'
import { check24HourCoverage } from '@/lib/lawChecks/ThreeSplitAverage/24HourCoverageCheck'
import { checkVacationOverlays } from '@/lib/lawChecks/ThreeSplitAverage/VacationCheck'
import {
  createSundayTimeZones,
  calculateTimeZoneOverlap,
  calculateNightHoursInZone,
  calculateNightHours20to6,
  getRotationDate,
  formatDateLocal,
  buildThreeSplitDetails,
  adjustHolidayZonesForNightStart,
  mergeOverlappingTimeZones
} from '@/lib/lawChecks/ThreeSplitAverage/ThreeSplitAverageUtils'

/**
 * Three-Split Average Check (Refactored with helper files)
 *
 * This check properly handles overlays (F3/F4/F5/FE) by:
 * 1. Only counting the UNDERLYING shift's hours (not F3/F4/F5 themselves)
 * 2. Using robust timezone overlap calculations
 * 3. Properly tracking which shifts are in holiday/Sunday zones
 * 4. Avoiding double-counting: hours that are BOTH night AND in holiday zones are counted as NIGHT only (better credit)
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
 * Reduction rules:
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
    },
    {
      title: 'Ny tariffbestemmelse om arbeidstid – utfyllende om beregning fordeltidsstillinger',
      url: 'https://www.ks.no/contentassets/8f9b17499f234bb8b556c546272be4cc/beregning-for-deltid-b-rundskrivnr-1-2011.pdf'
    }
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
    },
    {
      id: 'reduceByF3',
      label: 'Reduser med F3 timar',
      type: 'boolean',
      defaultValue: true
    },
    {
      id: 'reduceByF4',
      label: 'Reduser med F4 timar',
      type: 'boolean',
      defaultValue: false
    },
    {
      id: 'reduceByF5',
      label: 'Reduser med F5 timar',
      type: 'boolean',
      defaultValue: false
    },
    {
      id: 'reduceByVacation',
      label: 'Reduser med feriedagar',
      type: 'boolean',
      defaultValue: true
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

    // Determine actual weeks from rotations
    const actualWeeks = effectiveRotations.length > 0 
      ? Math.max(...effectiveRotations.map(r => r.week_index)) + 1 
      : plan.duration_weeks
    
    console.log('Actual weeks in rotations:', actualWeeks)

    // Plan dates
    const planStartDate = new Date(plan.date_started)
    const planEndDate = new Date(planStartDate)
    planEndDate.setDate(planEndDate.getDate() + actualWeeks * 7)

    // Build Sunday and holiday zones
    const allTimeZones: HolidayTimeZone[] = []

    // Sunday zones WITHOUT night adjustment yet (pass false to defer adjustment)
    allTimeZones.push(...createSundayTimeZones(planStartDate, planEndDate, plan.tariffavtale, false))

    if (plan.type === 'helping' || (plan.type === 'year' && plan.year_plan_mode !== 'rotation_based')) {
      const startYear = planStartDate.getFullYear()
      const endYear = planEndDate.getFullYear()
      for (let year = startYear; year <= endYear; year++) {
        const holidayZones = getHolidayTimeZones(year)
        // Add holiday zones as-is (they already have correct times from the holiday definition)
        // DO NOT extend them to full day - they end when they end (e.g., 22:00 for Constitution Day)
        allTimeZones.push(...holidayZones)
      }
    }

    // Filter to relevant zones
    let relevantTimeZones = allTimeZones.filter(zone =>
      zone.startDateTime < planEndDate && zone.endDateTime > planStartDate
    )

    // ⭐ CRITICAL ORDER: Merge FIRST (overlapping zones only), then adjust for night
    // Step 1: Merge overlapping zones (e.g., Sunday + Constitution Day that actually overlap in time)
    console.log(`\n🔄 MERGING overlapping zones BEFORE night adjustment`)
    console.log(`   Only zones that overlap in TIME will be merged`)
    console.log(`   Merged zones take EARLIEST end time to respect holiday boundaries`)
    console.log(`   (e.g., Constitution Day 22:00 + Sunday 23:59 → merged ends at 22:00)`)
    relevantTimeZones = mergeOverlappingTimeZones(relevantTimeZones)
    
    // Step 2: NOW adjust ALL zones (including merged ones) to end at night start
    console.log(`\n🔧 ADJUSTING merged zones to end at night start`)
    relevantTimeZones = adjustHolidayZonesForNightStart(relevantTimeZones, plan.tariffavtale)

    relevantTimeZones.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())

    console.log(`\n📋 FINAL ZONE LIST (after merging overlaps & adjusting for night):`)
    relevantTimeZones.forEach(zone => {
      console.log(`  ${zone.localName} (${formatDateLocal(zone.startDateTime)} ${zone.startDateTime.getHours()}:${zone.startDateTime.getMinutes().toString().padStart(2,'0')} → ${formatDateLocal(zone.endDateTime)} ${zone.endDateTime.getHours()}:${zone.endDateTime.getMinutes().toString().padStart(2,'0')})`)
    })

    // Calculate zones worked (only counting underlying shifts, excluding overlays)
    const zonesWorked: Array<{
      zone: HolidayTimeZone
      overlapHours: number
      isWorked: boolean
      rotationDates: string[]
    }> = []

    relevantTimeZones.forEach(zone => {
      let totalOverlapHours = 0
      const rotationDatesInZone: string[] = []

      effectiveRotations.forEach(rotation => {
        if (!rotation.shift_id) return
        const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
        
        // Skip default shifts (F1-F5, FE) AND skip if there's an overlay (F3/F4/F5/FE)
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
        if (rotation.overlay_shift_id) {
          const overlayShift = effectiveShifts.find(s => s.id === rotation.overlay_shift_id)
          if (overlayShift && overlayShift.is_default) return // Skip this rotation entirely
        }

        const overlapHours = calculateTimeZoneOverlap(rotation, shift, zone, planStartDate)
        if (overlapHours > 0) {
          totalOverlapHours += overlapHours
          const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)
          const dateStr = formatDateLocal(rotationDate)
          if (!rotationDatesInZone.includes(dateStr)) {
            rotationDatesInZone.push(dateStr)
          }
        }
      })

      zonesWorked.push({
        zone,
        overlapHours: totalOverlapHours,
        isWorked: totalOverlapHours > 0,
        rotationDates: rotationDatesInZone.sort()
      })
    })

    let totalHolidayHoursWorked = zonesWorked
      .filter(z => z.isWorked)
      .reduce((sum, z) => sum + z.overlapHours, 0)

    // Debug: log worked zones
    console.log('\n🟥 RED DAY / SUNDAY ZONES (Excluding F3/F4/F5/FE overlays)')
    let totalStuff = 0
    zonesWorked.forEach(zw => {
      if (zw.isWorked && zw.overlapHours > 0) {
        const datesStr = zw.rotationDates.join(', ')
        totalStuff += zw.overlapHours
        console.log(
          `  ${datesStr} | ${zw.zone.holidayName.padEnd(10)} | ${zw.overlapHours.toFixed(2)}h worked`
        )
      }
    })
  console.log(totalStuff)
    // Calculate night hours (20:00–06:00) for 35.5 criterion (excluding overlays)
    console.log('\n🌙 NIGHT HOURS CALCULATION (20:00–06:00 for 35.5h check) - Excluding overlays')
    let totalNightHours20to6 = 0

    effectiveRotations.forEach((rotation: Rotation) => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find((s: Shift) => s.id === rotation.shift_id)
      
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
      
      // Skip if there's an overlay (F3/F4/F5/FE)
      if (rotation.overlay_shift_id) {
        const overlayShift = effectiveShifts.find(s => s.id === rotation.overlay_shift_id)
        if (overlayShift && overlayShift.is_default) return
      }

      const nightHours = calculateNightHours20to6(shift.start_time, shift.end_time)
      if (nightHours > 0) {
        console.log(
          `  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week}: ${shift.name} (${shift.start_time}-${shift.end_time}) → ${nightHours.toFixed(2)}h night (20–06)`
        )
      }
      totalNightHours20to6 += nightHours
    })

    const avgNightHoursPerWeek20to6 = totalNightHours20to6 / actualWeeks
    console.log(`  → Average per week: ${avgNightHoursPerWeek20to6.toFixed(2)}h`)

    // Sunday frequency check
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

    // 24-hour coverage check
    const has24HourCoverage = check24HourCoverage(effectiveRotations, effectiveShifts)

    // Tariff night hours and total hours (excluding overlays)
    console.log(`\n🌙 TARIFF NIGHT HOURS (${plan.tariffavtale.toUpperCase()} – ${getNightHoursLabel(plan.tariffavtale)}) - Excluding overlays`)
    const calculateNightHours = getNightHoursCalculator(plan.tariffavtale)
    const nightHoursLabel = getNightHoursLabel(plan.tariffavtale)

    let totalHours = 0
    let totalNightHoursTariff = 0

    effectiveRotations.forEach(rotation => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
      
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
      
      // Skip if there's an overlay (F3/F4/F5/FE)
      if (rotation.overlay_shift_id) {
        const overlayShift = effectiveShifts.find(s => s.id === rotation.overlay_shift_id)
        if (overlayShift && overlayShift.is_default) return
      }

      const shiftHours = calculateShiftHours(shift.start_time, shift.end_time)
      const tariffNight = calculateNightHours(shift.start_time, shift.end_time)
      totalHours += shiftHours
      totalNightHoursTariff += tariffNight

      if (tariffNight > 0) {
        console.log(
          `  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week}: ${shift.name} (${shift.start_time}-${shift.end_time}) → ${tariffNight.toFixed(2)}h night (${nightHoursLabel})`
        )
      }
    })

    console.log(`  → Total tariff night hours: ${totalNightHoursTariff.toFixed(2)}h`)

    const nonNightHours = totalHours - totalNightHoursTariff
    const nonNightPercent = totalHours > 0 ? (nonNightHours / totalHours) * 100 : 0
    const meetsNonNightRequirement = nonNightPercent >= requiredNonNightPercent

    // ===== KEY FIX: Calculate night hours that fall within holiday/Sunday zones =====
    // This prevents double-counting hours that qualify for BOTH night credit (0.25) AND holiday credit (10/60)
    // We prioritize night credit since it's better (0.25 vs 0.167 per hour)
    // IMPORTANT: Exclude overlays (F3/F4/F5/FE) from this calculation
    console.log('\n🌙 CALCULATING NIGHT HOURS IN HOLIDAY ZONES (to avoid double-counting)')
    let nightHoursInHolidayZones = 0

    effectiveRotations.forEach(rotation => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
      
      // Skip default shifts (F1-F5, FE) - they don't contribute actual worked hours
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
      
      // Skip if there's an overlay (F3/F4/F5/FE)
      if (rotation.overlay_shift_id) {
        const overlayShift = effectiveShifts.find(s => s.id === rotation.overlay_shift_id)
        if (overlayShift && overlayShift.is_default) return
      }

      // Check each relevant holiday/Sunday zone
      relevantTimeZones.forEach(zone => {
        const zoneOverlap = calculateTimeZoneOverlap(rotation, shift, zone, planStartDate)
        if (zoneOverlap > 0) {
          // Calculate how much of this zone overlap is during night hours (tariff-specific)
          const nightOverlapInZone = calculateNightHoursInZone(
            rotation, 
            shift, 
            zone, 
            planStartDate, 
            plan.tariffavtale
          )
          
          if (nightOverlapInZone > 0) {
            const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)
            console.log(
              `  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week} (${formatDateLocal(rotationDate)}): ${shift.name} ` +
              `in zone ${zone.holidayName} → ${nightOverlapInZone.toFixed(2)}h night in zone`
            )
            nightHoursInHolidayZones += nightOverlapInZone
          }
        }
      })
    })

    console.log(`  → Total night hours in holiday/Sunday zones: ${nightHoursInHolidayZones.toFixed(2)}h`)
    console.log(`  → These will be subtracted from holiday hours to avoid double-counting`)

    // Adjust holiday hours by subtracting night hours that fall in zones
    const rawHolidayHoursBeforeAdjustment = totalHolidayHoursWorked
    console.log(`\n⚠️ HOLIDAY HOURS ADJUSTMENT FOR NIGHT OVERLAP:`)
    console.log(`  Holiday/Sunday hours (raw from zones, overlays excluded): ${totalHolidayHoursWorked.toFixed(2)}h`)
    console.log(`  Night hours in zones (to subtract): ${nightHoursInHolidayZones.toFixed(2)}h`)
    totalHolidayHoursWorked = Math.max(0, totalHolidayHoursWorked - nightHoursInHolidayZones)
    console.log(`  Final holiday/Sunday hours: ${totalHolidayHoursWorked.toFixed(2)}h`)
    console.log(`  → Night hours in zones will be credited at 0.25 (night rate)`)
    console.log(`  → Remaining holiday hours will be credited at ${(10/60).toFixed(3)} (holiday rate)`)

    // Calculate F3/F4/F5 overlay hours - these are now purely informational since overlays were excluded from calculations
    const overlayDays: Array<{ type: string; week: number; day: number; date: string; underlyingShift: string; hours: number }> = []
    
    effectiveRotations.forEach(rotation => {
      if (rotation.overlay_shift_id) {
        const overlayShift = effectiveShifts.find(s => s.id === rotation.overlay_shift_id)
        if (overlayShift && overlayShift.is_default) {
          const underlyingShift = rotation.shift_id 
            ? effectiveShifts.find(s => s.id === rotation.shift_id)
            : null
          
          const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)
          
          let underlayHours = 0
          if (underlyingShift && underlyingShift.start_time && underlyingShift.end_time) {
            underlayHours = calculateShiftHours(underlyingShift.start_time, underlyingShift.end_time)
          }
          
          overlayDays.push({
            type: overlayShift.name,
            week: rotation.week_index + 1,
            day: rotation.day_of_week,
            date: formatDateLocal(rotationDate),
            underlyingShift: underlyingShift ? underlyingShift.name : 'None',
            hours: underlayHours
          })
        }
      }
    })

    const rawNightHoursBeforeAdjustment = totalNightHoursTariff
    
    console.log(`\n⚠️ OVERLAY INFORMATION (F3/F4/F5/FE already excluded from all calculations):`)
    console.log(`  Total overlays found: ${overlayDays.length}`)
    console.log(`  These hours were automatically excluded from:`)
    console.log(`    - Total hours calculation`)
    console.log(`    - Night hours calculation`)
    console.log(`    - Holiday/Sunday zone hours calculation`)
    console.log(`  → No adjustment needed - already excluded at source`)

    // Qualification checks
    const meetsNightHours35 = avgNightHoursPerWeek20to6 >= requiredNightHours
    const qualifiesFor35_5 = meetsNightHours35 || meetsSundayRequirement
    const qualifiesFor33_6 = has24HourCoverage && meetsSundayRequirement && meetsNonNightRequirement

    // Check F3/F4/F5 overlays
    const f3 = inputs.reduceByF3 ? checkF3Overlays(effectiveRotations, effectiveShifts, relevantTimeZones, planStartDate, plan.tariffavtale) : null
    const f4 = inputs.reduceByF4 ? checkF4Overlays(effectiveRotations, effectiveShifts, relevantTimeZones, planStartDate, plan.tariffavtale) : null
    const f5 = inputs.reduceByF5 ? checkF5Overlays(effectiveRotations, effectiveShifts, relevantTimeZones, planStartDate, plan.tariffavtale) : null

    const actualAvgHoursPerWeek = totalHours / actualWeeks

    // Compute reductions and expected max hours
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
      const weeks = actualWeeks

      reductionFromNight = totalNightHoursTariff * 0.25 / weeks
      reductionFromHoliday = (totalHolidayHoursWorked * (10 / 60)) / weeks

      reductionFromNightTotal = totalNightHoursTariff * 0.25
      reductionFromHolidayTotal = (totalHolidayHoursWorked * (10 / 60))

      reductionFromHolidayPostPercent = (reductionFromHoliday * workPercentFactor)

      computedReduction = reductionFromNight + reductionFromHolidayPostPercent
      appliedReduction = computedReduction

      computedWeeklyAfterReduction = baseStandardWeek - appliedReduction

      const upperBound = 35.5 * workPercentFactor
      const lowerBound = 33.6 * workPercentFactor

      if (computedWeeklyAfterReduction > upperBound) {
        expectedMaxHours = upperBound
      } else if (computedWeeklyAfterReduction < lowerBound) {
        expectedMaxHours = lowerBound
      } else {
        expectedMaxHours = computedWeeklyAfterReduction
      }
    } else if (qualifiesFor35_5) {
      expectedMaxHours = 35.5 * workPercentFactor
      computedReduction = baseStandardWeek - expectedMaxHours
      reductionFromNight = totalNightHoursTariff * 0.25
      reductionFromHoliday = totalHolidayHoursWorked * (10 / 60)
      appliedReduction = computedReduction
      computedWeeklyAfterReduction = expectedMaxHours
    } else {
      expectedMaxHours = baseStandardWeek
      computedReduction = 0
      reductionFromNight = 0
      reductionFromHoliday = 0
      appliedReduction = 0
      computedWeeklyAfterReduction = baseStandardWeek
    }

    const exceedsHourLimit = actualAvgHoursPerWeek > expectedMaxHours

    console.log('\n📊 Qualification Metrics (FIXED):')
    console.log(`  Qualifies for 35.5h: ${qualifiesFor35_5}`)
    console.log(`  Qualifies for 33.6h: ${qualifiesFor33_6}`)
    console.log(`  Avg weekly hours (actual, excluding F1-F5): ${actualAvgHoursPerWeek.toFixed(2)}h/week`)
    console.log(`  Computed weekly after reduction: ${computedWeeklyAfterReduction.toFixed(2)}h/week`)
    console.log(`  Expected max hours (final): ${expectedMaxHours.toFixed(2)}h/week`)
    console.log(`  Exceeds hour limit: ${exceedsHourLimit}`)

    // Log F3/F4/F5 days
    console.log('\n📋 F3/F4/F5/FE OVERLAY DAYS:')
    overlayDays.sort((a, b) => a.date.localeCompare(b.date))

    const f3Days = overlayDays.filter(d => d.type === 'F3')
    const f4Days = overlayDays.filter(d => d.type === 'F4')
    const f5Days = overlayDays.filter(d => d.type === 'F5')
    const vacationDays = overlayDays.filter(d => d.type === 'FE')

    if (f3Days.length > 0) {
      console.log(`\n  F3 (Helgedags fri) - ${f3Days.length} days:`)
      f3Days.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        console.log(`    Week ${d.week}, ${dayNames[d.day]} (${d.date}) - Underlying: ${d.underlyingShift} (${d.hours.toFixed(2)}h)`)
      })
    }

    if (f4Days.length > 0) {
      console.log(`\n  F4 (Feriedagar) - ${f4Days.length} days:`)
      f4Days.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        console.log(`    Week ${d.week}, ${dayNames[d.day]} (${d.date}) - Underlying: ${d.underlyingShift} (${d.hours.toFixed(2)}h)`)
      })
    }

    if (f5Days.length > 0) {
      console.log(`\n  F5 (Erstatningsfridagar) - ${f5Days.length} days:`)
      f5Days.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        console.log(`    Week ${d.week}, ${dayNames[d.day]} (${d.date}) - Underlying: ${d.underlyingShift} (${d.hours.toFixed(2)}h)`)
      })
    }

    if (vacationDays.length > 0) {
      console.log(`\n  FE (Feriedagar) - ${vacationDays.length} days:`)
      vacationDays.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        console.log(`    Week ${d.week}, ${dayNames[d.day]} (${d.date}) - Underlying: ${d.underlyingShift} (${d.hours.toFixed(2)}h)`)
      })
    }

    // Prepare result details
    const planTypeDesc = plan.type === 'helping' ? 'Helping plan' :
      plan.type === 'year' && plan.year_plan_mode !== 'rotation_based' ? 'Year plan (non-rotation)' :
      'Main plan'

    const totalRedDaysWorked = zonesWorked.filter(z => z.isWorked && z.zone.holidayName !== 'Sunday').length
    const totalHolidayZones = zonesWorked.filter(z => z.zone.holidayName !== 'Sunday').length

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
      planDurationWeeks: actualWeeks,
      planWorkPercent: plan.work_percent,
      hoursToSubtractFromFShifts: 0, // No longer needed - overlays excluded at source
      hoursToSubtractFromFShiftsNight: 0, // No longer needed - overlays excluded at source
      hoursToSubtractFromVacation: 0, // No longer needed - overlays excluded at source
      hoursToSubtractFromVacationNight: 0, // No longer needed - overlays excluded at source
      nightHoursInHolidayZones,
      rawHolidayHoursBeforeAdjustment,
      rawNightHoursBeforeAdjustment,
      f3Days: f3Days.length,
      f4Days: f4Days.length,
      f5Days: f5Days.length,
      vacationDays: vacationDays.length,
      overlayDays
    })

    // Set final status and message
    if ((qualifiesFor33_6 || qualifiesFor35_5) && !exceedsHourLimit) {
      result.status = 'pass'
      if (qualifiesFor33_6) {
        result.message = `Timetalet i turnusen er korrekt. Kvalifiserer for 3-delt snitt med timetal på: **${expectedMaxHours.toFixed(2)}t/veke**`
      } else {
        result.message = `Timetalet i turnusen er korrekt. Kvalifiserer for: **${expectedMaxHours.toFixed(2)}t/veke** (35,5t x ${plan.work_percent}%). Kvalifiserer ikkje til 3-delt snitt.`
      }
    } else if ((qualifiesFor33_6 || qualifiesFor35_5) && exceedsHourLimit) {
      result.status = 'fail'
      const reduceBy = actualAvgHoursPerWeek - expectedMaxHours
      const totalReduction = reduceBy * actualWeeks
      result.message = `Turnusen inneheld: **${actualAvgHoursPerWeek.toFixed(2)}t/veke**, men skal innehalde: **${expectedMaxHours.toFixed(2)}t/veke**. Turnusen må reduserast med **${reduceBy.toFixed(2)}t/veke** eller reduser med **${totalReduction.toFixed(2)}t** totalt.`

      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: `Turnusen inneheld: ${actualAvgHoursPerWeek.toFixed(2)}t/veke, men skal innehalde: ${expectedMaxHours.toFixed(2)}t/veke. Turnusen må reduserast med ${reduceBy.toFixed(2)}t/veke eller ${totalReduction.toFixed(2)}t totalt.`
      }]
    } else {
      result.status = 'fail'
      result.message = `Kvalifiserer ikkje for 35,5t/veke eller 3-delt snitt. Du kan vere kvalifisert som turnusarbeidar med 37,5t arbeidsveke. Så du har rett på tillegg frå Tariffavtalen.`
      result.violations = [{
        weekIndex: -1,
        dayOfWeek: -1,
        description: 'Does not meet requirements for either 35.5h or 33.6h work week'
      }]
    }

    return result
  }
}