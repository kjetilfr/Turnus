// src/lib/lawChecks/ThreeSplitAverageCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getNightHoursCalculator, getNightHoursLabel, getNightPeriodDefinition } from '@/lib/utils/shiftTimePeriods'
import { getHolidayTimeZones, HolidayTimeZone } from '@/lib/utils/norwegianHolidayTimeZones'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'


/**
 * Three-Split Average Check (Fixed with proper F3/F4/F5 handling)
 *
 * CRITICAL FIX: This check now properly handles overlays (F3/F4/F5) by:
 * 1. Only counting the UNDERLYING shift's hours (not F3/F4/F5 themselves)
 * 2. Using the robust timezone overlap calculation from F3HolidayCompensationCheck
 * 3. Properly tracking which shifts are in holiday/Sunday zones
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

    // ============================================================
    // CRITICAL FIX: Properly handle overlays (F3/F4/F5)
    // Only count the UNDERLYING shift hours, not the overlay itself
    // ============================================================
    
    // Determine, per-zone, whether worked and hours overlapped
    const zonesWorked: Array<{
      zone: HolidayTimeZone
      overlapHours: number
      isWorked: boolean
    }> = []

    relevantTimeZones.forEach(zone => {
      let totalOverlapHours = 0

      effectiveRotations.forEach(rotation => {
        // CRITICAL: Get the UNDERLYING shift (shift_id), not overlay
        if (!rotation.shift_id) return
        const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
        
        // Skip default shifts (F1-F5) and shifts without time info
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

        // Calculate overlap using the robust method from F3HolidayCompensationCheck
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
    console.log('\n🟥 RED DAY / SUNDAY ZONES (Fixed with proper overlay handling)')
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
    // FIXED: Only count underlying shift hours
    // ============================================================
    console.log('\n🌙 NIGHT HOURS CALCULATION (20:00–06:00 for 35.5h check) - Fixed')
    let totalNightHours20to6 = 0

    effectiveRotations.forEach((rotation: Rotation) => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find((s: Shift) => s.id === rotation.shift_id)
      
      // CRITICAL: Skip if this is a default shift (F1-F5)
      // We only want to count actual work shifts
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

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
    // 24-hour coverage check (using UNDERLYING shifts only)
    // ============================================================
    const has24HourCoverage = check24HourCoverage(effectiveRotations, effectiveShifts)

    // ============================================================
    // Tariff night hours (for 33.6) and total hours
    // FIXED: Only count underlying shift hours
    // ============================================================
    console.log(`\n🌙 TARIFF NIGHT HOURS (${plan.tariffavtale.toUpperCase()} – ${getNightHoursLabel(plan.tariffavtale)}) - Fixed`)
    const calculateNightHours = getNightHoursCalculator(plan.tariffavtale)
    const nightHoursLabel = getNightHoursLabel(plan.tariffavtale)

    let totalHours = 0
    let totalNightHoursTariff = 0

    // We'll also compute totalHolidayHoursWorked: sum of overlapHours across worked holiday/Sunday zones
    let totalHolidayHoursWorked = zonesWorked
      .filter(z => z.isWorked)
      .reduce((sum, z) => sum + z.overlapHours, 0)

    effectiveRotations.forEach(rotation => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
      
      // CRITICAL: Skip default shifts (F1-F5)
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

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
    console.log(`  → Total holiday/Sunday hours worked (zones - BEFORE F3/F4/F5 adjustment): ${totalHolidayHoursWorked.toFixed(2)}h`)

    const nonNightHours = totalHours - totalNightHoursTariff
    const nonNightPercent = totalHours > 0 ? (nonNightHours / totalHours) * 100 : 0
    const meetsNonNightRequirement = nonNightPercent >= requiredNonNightPercent

    // ============================================================
    // CRITICAL: Calculate F3/F4/F5 overlay hours BEFORE reduction calculation
    // ============================================================
    let hoursToSubtractFromHoliday = 0
    const overlayDays: Array<{ type: string; week: number; day: number; date: string; underlyingShift: string; hours: number }> = []
    
    // Track night hours that overlap with holiday zones to avoid double-counting
    let nightHoursInHolidayZones = 0
    
    effectiveRotations.forEach(rotation => {
      // Check if there's an overlay
      if (rotation.overlay_shift_id) {
        const overlayShift = effectiveShifts.find(s => s.id === rotation.overlay_shift_id)
        if (overlayShift && overlayShift.is_default) {
          const underlyingShift = rotation.shift_id 
            ? effectiveShifts.find(s => s.id === rotation.shift_id)
            : null
          
          const rotationDate = getRotationDate(planStartDate, rotation.week_index, rotation.day_of_week)
          
          // Calculate how many hours this underlying shift contributes
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
          
          // For F3/F4/F5, check if this day overlaps with a holiday/Sunday zone
          // If it does, we need to subtract these hours from totalHolidayHoursWorked
          if (overlayShift.name === 'F3' || overlayShift.name === 'F4' || overlayShift.name === 'F5') {
            // Find if this rotation overlaps with any zone
            relevantTimeZones.forEach(zone => {
              if (underlyingShift && underlyingShift.start_time && underlyingShift.end_time) {
                const overlap = calculateTimeZoneOverlap(rotation, underlyingShift, zone, planStartDate)
                if (overlap > 0) {
                  hoursToSubtractFromHoliday += overlap
                }
              }
            })
          }
        }
      }
    })

    // Calculate night hours that overlap with holiday/Sunday zones
    // These should be subtracted from holiday hours since night credit is higher (0.25 vs 10/60=0.167)
    effectiveRotations.forEach(rotation => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
      
      // Skip default shifts (F1-F5)
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

      // Check if this shift overlaps with any holiday/Sunday zone
      relevantTimeZones.forEach(zone => {
        const zoneOverlap = calculateTimeZoneOverlap(rotation, shift, zone, planStartDate)
        if (zoneOverlap > 0) {
          // Calculate how much of this zone overlap is also night hours
          const nightHoursInThisShift = calculateNightHours(shift.start_time, shift.end_time)
          
          // Calculate the overlap between night hours and the holiday zone
          // This is a simplified approach: we calculate what portion of the shift is both in zone AND in night period
          const nightOverlapInZone = calculateNightHoursInZone(rotation, shift, zone, planStartDate, plan.tariffavtale)
          
          if (nightOverlapInZone > 0) {
            nightHoursInHolidayZones += nightOverlapInZone
          }
        }
      })
    })

    // Apply the subtraction BEFORE reduction calculation
    const rawHolidayHoursBeforeAdjustment = totalHolidayHoursWorked
    console.log(`\n⚠️  OVERLAY HOUR ADJUSTMENT (before reduction calculation):`)
    console.log(`  Total holiday/Sunday hours (raw from zones): ${totalHolidayHoursWorked.toFixed(2)}h`)
    console.log(`  Hours to subtract (F3/F4/F5 overlays): ${hoursToSubtractFromHoliday.toFixed(2)}h`)
    console.log(`  Hours to subtract (night hours in zones - avoid double count): ${nightHoursInHolidayZones.toFixed(2)}h`)
    totalHolidayHoursWorked = Math.max(0, totalHolidayHoursWorked - hoursToSubtractFromHoliday - nightHoursInHolidayZones)
    console.log(`  Adjusted holiday/Sunday hours: ${totalHolidayHoursWorked.toFixed(2)}h`)

    // ============================================================
    // Qualification checks
    // ============================================================
    const meetsNightHours35 = avgNightHoursPerWeek20to6 >= requiredNightHours
    const qualifiesFor35_5 = meetsNightHours35 || meetsSundayRequirement
    const qualifiesFor33_6 = has24HourCoverage && meetsSundayRequirement && meetsNonNightRequirement

    const actualAvgHoursPerWeek = totalHours / actualWeeks

    // ============================================================
    // Compute reductions and expectedMaxHours according to rules
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
      const weeks = actualWeeks;

      reductionFromNight = totalNightHoursTariff * 0.25 / weeks // per week
      reductionFromHoliday = (totalHolidayHoursWorked * (10 / 60)) / weeks // per week

      reductionFromNightTotal = totalNightHoursTariff * 0.25
      reductionFromHolidayTotal = (totalHolidayHoursWorked * (10 / 60))

      reductionFromHolidayPostPercent = (reductionFromHoliday * workPercentFactor)

      computedReduction = reductionFromNight + reductionFromHolidayPostPercent
      appliedReduction = computedReduction

      // Calculate candidate hours after reduction
      computedWeeklyAfterReduction = baseStandardWeek - appliedReduction

      // Reference bounds for 33.6h qualification (scaled by work percent)
      const upperBound = 35.5 * workPercentFactor  // 35.5h reference
      const lowerBound = 33.6 * workPercentFactor  // 33.6h reference

      // The result MUST be between lowerBound and upperBound
      if (computedWeeklyAfterReduction > upperBound) {
        // Reduction wasn't enough, cap at upper bound (35.5h)
        expectedMaxHours = upperBound
      } else if (computedWeeklyAfterReduction < lowerBound) {
        // Reduction was too much, cap at lower bound (33.6h)
        expectedMaxHours = lowerBound
      } else {
        // Reduction puts us within bounds, use computed value
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
      // Standard week applies
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

    // ============================================================
    // LIST ALL F3, F4, F5 DAYS FOR DEBUGGING
    // ============================================================
    console.log('\n📋 F3/F4/F5 OVERLAY DAYS:')

    // Sort by date
    overlayDays.sort((a, b) => a.date.localeCompare(b.date))

    // Group by type
    const f3Days = overlayDays.filter(d => d.type === 'F3')
    const f4Days = overlayDays.filter(d => d.type === 'F4')
    const f5Days = overlayDays.filter(d => d.type === 'F5')

    if (f3Days.length > 0) {
      console.log(`\n  F3 (Helgedags fri) - ${f3Days.length} days:`)
      f3Days.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        console.log(`    Week ${d.week}, ${dayNames[d.day]} (${d.date}) - Underlying: ${d.underlyingShift} (${d.hours.toFixed(2)}h)`)
      })
    } else {
      console.log(`\n  F3 (Helgedags fri): None`)
    }

    if (f4Days.length > 0) {
      console.log(`\n  F4 (Feriedagar) - ${f4Days.length} days:`)
      f4Days.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        console.log(`    Week ${d.week}, ${dayNames[d.day]} (${d.date}) - Underlying: ${d.underlyingShift} (${d.hours.toFixed(2)}h)`)
      })
    } else {
      console.log(`\n  F4 (Feriedagar): None`)
    }

    if (f5Days.length > 0) {
      console.log(`\n  F5 (Erstatningsfridagar) - ${f5Days.length} days:`)
      f5Days.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        console.log(`    Week ${d.week}, ${dayNames[d.day]} (${d.date}) - Underlying: ${d.underlyingShift} (${d.hours.toFixed(2)}h)`)
      })
    } else {
      console.log(`\n  F5 (Erstatningsfridagar): None`)
    }

    // ============================================================
    // Prepare result details
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
      planDurationWeeks: actualWeeks,
      planWorkPercent: plan.work_percent,
      hoursToSubtractFromHoliday,
      nightHoursInHolidayZones,
      rawHolidayHoursBeforeAdjustment,
      f3Days: f3Days.length,
      f4Days: f4Days.length,
      f5Days: f5Days.length,
      overlayDays
    })

    // Violations and summary status
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

// ============================================================
// Helper Functions (copied from F3HolidayCompensationCheck)
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
 * Calculate overlap between a rotation/shift and a time zone
 * COPIED FROM F3HolidayCompensationCheck for consistency
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
 * Format date as YYYY-MM-DD in local timezone
 */
function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
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
 * Calculate night hours that fall within a specific holiday/Sunday zone
 * This is used to avoid double-counting hours that qualify for both night credit (0.25) and holiday credit (10/60)
 * Since night credit is higher, we subtract these overlapping hours from holiday hours
 */
function calculateNightHoursInZone(
  rotation: Rotation,
  shift: Shift,
  zone: HolidayTimeZone,
  planStartDate: Date,
  tariffavtale: string
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
    const saturday = new Date(rotationDate)
    saturday.setDate(saturday.getDate() - 1)

    shiftStartDateTime = new Date(saturday)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else if (isNightShift) {
    const prevDay = new Date(rotationDate)
    prevDay.setDate(prevDay.getDate() - 1)

    shiftStartDateTime = new Date(prevDay)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  } else {
    shiftStartDateTime = new Date(rotationDate)
    shiftStartDateTime.setHours(startTime.hour, startTime.minute, 0, 0)

    shiftEndDateTime = new Date(rotationDate)
    shiftEndDateTime.setHours(endTime.hour, endTime.minute, 0, 0)
  }

  // Get night period based on tariffavtale
  const nightPeriod = getNightPeriodDefinition(tariffavtale)
  
  // Calculate what time periods we need to check for night hours
  // Night period wraps around midnight, so we need to check two segments
  const nightStartToday = new Date(shiftStartDateTime)
  nightStartToday.setHours(nightPeriod.start, 0, 0, 0)
  
  const nightEndToday = new Date(shiftStartDateTime)
  nightEndToday.setHours(nightPeriod.end, 0, 0, 0)
  if (nightPeriod.end < nightPeriod.start) {
    // Night period crosses midnight (e.g., 21:00-06:00)
    nightEndToday.setDate(nightEndToday.getDate() + 1)
  }

  // Also check previous day's night period (for shifts that might span it)
  const nightStartYesterday = new Date(nightStartToday)
  nightStartYesterday.setDate(nightStartYesterday.getDate() - 1)
  
  const nightEndYesterday = new Date(nightEndToday)
  nightEndYesterday.setDate(nightEndYesterday.getDate() - 1)

  let totalNightInZone = 0

  // Check overlap between: (shift AND zone AND night period)
  const zoneStart = zone.startDateTime
  const zoneEnd = zone.endDateTime

  // Helper to calculate triple overlap
  const calculateTripleOverlap = (nightStart: Date, nightEnd: Date) => {
    // Find the intersection of all three periods: shift, zone, night
    const overlapStart = new Date(Math.max(
      shiftStartDateTime.getTime(),
      zoneStart.getTime(),
      nightStart.getTime()
    ))
    
    const overlapEnd = new Date(Math.min(
      shiftEndDateTime.getTime(),
      zoneEnd.getTime(),
      nightEnd.getTime()
    ))

    if (overlapStart < overlapEnd) {
      return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60)
    }
    return 0
  }

  // Check both today's and yesterday's night periods
  totalNightInZone += calculateTripleOverlap(nightStartYesterday, nightEndYesterday)
  totalNightInZone += calculateTripleOverlap(nightStartToday, nightEndToday)

  return totalNightInZone
}

/**
 * Check 24-hour coverage (only using non-default shifts)
 */
function check24HourCoverage(rotations: Rotation[], shifts: Shift[]): boolean {
  const timeRanges: Array<{ start: number; end: number }> = []

  rotations.forEach((rotation: Rotation) => {
    if (rotation.shift_id) {
      const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
      
      // CRITICAL: Skip default shifts (F1-F5)
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

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
  totalHolidayHoursWorked: number          // AFTER all adjustments
  reductionFromNight: number               // per week credit (used for final weekly calc)
  reductionFromHoliday: number             // per week credit (used for final weekly calc)
  reductionFromNightTotal: number          // total credit (before dividing by weeks)
  reductionFromHolidayTotal: number        // total credit (before dividing by weeks)
  reductionFromHolidayPostPercent: number  // scaled by work_percent
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
  planDurationWeeks: number                // total number of weeks in the plan
  planWorkPercent: number                  // work_percent of the plan
  hoursToSubtractFromHoliday: number       // F3/F4/F5 overlay hours subtracted
  nightHoursInHolidayZones: number         // Night hours in zones (avoid double-count)
  rawHolidayHoursBeforeAdjustment: number  // BEFORE F3/F4/F5 adjustment
  f3Days: number                           // count of F3 days
  f4Days: number                           // count of F4 days
  f5Days: number                           // count of F5 days
  overlayDays: Array<{ type: string; week: number; day: number; date: string; underlyingShift: string; hours: number }> // overlay details
}) : string[] {
  const p = params

  const header = [
    `Plan type: ${p.planTypeDesc}`,
    '',
    '⚠️ FIXED VERSION: Now properly excludes F3/F4/F5 overlay hours',
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

  // Calculate raw holiday hours before adjustment (use the passed-in raw value)
  const rawHolidayHours = p.rawHolidayHoursBeforeAdjustment
  const rawHolidayCredit = rawHolidayHours * (10 / 60)
  const adjustedHolidayCredit = p.totalHolidayHoursWorked * (10 / 60)
  const adjustedHolidayCreditPerWeek = adjustedHolidayCredit / p.planDurationWeeks

  const reductionSummary = [
    '=== REDUCTION CALCULATION (33.6 path) ===',
    `Base (standard) week: ${p.baseStandardWeek.toFixed(2)} h/week`,
    '',
    '--- Night Hours Credit ---',
    `Tariff night hours (used for night credit): ${p.totalNightHoursTariff.toFixed(2)} h → credit: ${p.reductionFromNightTotal.toFixed(2)} h`,
    `  → per week: ${(p.reductionFromNightTotal / p.planDurationWeeks).toFixed(2)} h/week`,
    '',
    '--- Holiday/Sunday Hours Credit (with F3/F4/F5 adjustment) ---',
    `Raw holiday/Sunday zone hours (before adjustment): ${rawHolidayHours.toFixed(2)} h`,
    ...(p.hoursToSubtractFromHoliday > 0 ? [
      `  F3 overlay days: ${p.f3Days} (hours to subtract included below)`,
      `  F4 overlay days: ${p.f4Days} (hours to subtract included below)`,
      `  F5 overlay days: ${p.f5Days} (hours to subtract included below)`,
      `  Hours to subtract (F3/F4/F5 that overlap zones): ${p.hoursToSubtractFromHoliday.toFixed(2)} h`,
      `  Raw holiday credit (before adjustment): ${rawHolidayCredit.toFixed(2)} h`,
    ] : [
      `  No F3/F4/F5 overlays found in holiday/Sunday zones`,
    ]),
    ...(p.nightHoursInHolidayZones > 0 ? [
      `  Hours to subtract (night hours in zones - higher credit): ${p.nightHoursInHolidayZones.toFixed(2)} h`,
      `  (Night credit: 0.25 vs Holiday credit: ${(10/60).toFixed(3)} → use night, subtract from holiday)`,
    ] : []),
    `Adjusted holiday/Sunday hours (after all subtractions): ${p.totalHolidayHoursWorked.toFixed(2)} h`,
    `  → adjusted credit: ${adjustedHolidayCredit.toFixed(2)} h`,
    `  → per week (before work % scaling): ${adjustedHolidayCreditPerWeek.toFixed(2)} h/week`,
    `  → scaled by work percent (${p.planWorkPercent}%): ${adjustedHolidayCreditPerWeek.toFixed(2)} × ${(p.planWorkPercent/100).toFixed(2)} = ${p.reductionFromHolidayPostPercent.toFixed(2)} h/week`,
    '',
    '--- Final Reduction Calculation ---',
    `Total computed reduction (night + holiday credits): ${p.computedReduction.toFixed(2)} h/week`,
    `Candidate weekly hours: ${p.baseStandardWeek.toFixed(2)} - ${p.appliedReduction.toFixed(2)} = ${p.computedWeeklyAfterReduction.toFixed(2)} h/week`,
    '',
    '--- Reference Bounds (33.6h qualification) ---',
    `Upper bound (35.5h × ${p.planWorkPercent}%): ${(35.5 * (p.planWorkPercent/100)).toFixed(2)} h/week`,
    `Lower bound (33.6h × ${p.planWorkPercent}%): ${(33.6 * (p.planWorkPercent/100)).toFixed(2)} h/week`,
    `Candidate value: ${p.computedWeeklyAfterReduction.toFixed(2)} h/week`,
    ...(p.computedWeeklyAfterReduction > (35.5 * (p.planWorkPercent/100)) ? [
      `  → Above upper bound, capped to ${(35.5 * (p.planWorkPercent/100)).toFixed(2)} h/week`,
    ] : p.computedWeeklyAfterReduction < (33.6 * (p.planWorkPercent/100)) ? [
      `  → Below lower bound, capped to ${(33.6 * (p.planWorkPercent/100)).toFixed(2)} h/week`,
    ] : [
      `  → Within bounds, using computed value`,
    ]),
    `Final allowed weekly (after bounds check): ${p.expectedMaxHours.toFixed(2)} h/week`,
    ''
  ]

  // Add overlay details if any exist
  if (p.overlayDays.length > 0) {
    reductionSummary.push('--- F3/F4/F5 Overlay Details ---')
    const f3List = p.overlayDays.filter(d => d.type === 'F3')
    const f4List = p.overlayDays.filter(d => d.type === 'F4')
    const f5List = p.overlayDays.filter(d => d.type === 'F5')

    if (f3List.length > 0) {
      reductionSummary.push(`F3 (Helgedags fri) - ${f3List.length} days:`)
      f3List.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        reductionSummary.push(`  Week ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}h`)
      })
    }
    if (f4List.length > 0) {
      reductionSummary.push(`F4 (Feriedagar) - ${f4List.length} days:`)
      f4List.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        reductionSummary.push(`  Week ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}h`)
      })
    }
    if (f5List.length > 0) {
      reductionSummary.push(`F5 (Erstatningsfridagar) - ${f5List.length} days:`)
      f5List.forEach(d => {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        reductionSummary.push(`  Week ${d.week}, ${dayNames[d.day]} (${d.date}): ${d.underlyingShift} - ${d.hours.toFixed(2)}h`)
      })
    }
    reductionSummary.push('')
  }

  const hoursSummary = [
    '=== HOURS / METRICS (raw numbers used) ===',
    `Total hours (sum of NON-DEFAULT shifts across rotations): ${p.totalHours.toFixed(2)} h`,
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
    `Holiday/Sunday hours worked (after F3/F4/F5 adjustment): ${p.totalHolidayHoursWorked.toFixed(2)} h`,
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