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
  createCombinedSundayZones,
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

    // Calculate zones worked (NOW INCLUDING overlays - we'll subtract later based on checkboxes)
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
        
        // Skip default shifts that are NOT underlays (F1-F5, FE that stand alone)
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
        
        // NOW WE INCLUDE rotations with overlays - they contribute to the BEFORE total

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
    console.log('\n🟥 RED DAY / SUNDAY ZONES (NOW INCLUDING F3/F4/F5/FE - will subtract later based on checkboxes)')
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
    // Calculate night hours (20:00–06:00) for 35.5 criterion (NOW INCLUDING overlays)
    console.log('\n🌙 NIGHT HOURS CALCULATION (20:00–06:00 for 35.5h check) - Including overlays')
    let totalNightHours20to6 = 0

    effectiveRotations.forEach((rotation: Rotation) => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find((s: Shift) => s.id === rotation.shift_id)
      
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
      
      // NOW WE INCLUDE rotations with overlays in the calculation

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

    // Sunday frequency check - use COMBINED weekend zones (not split)
    // For counting if a Sunday was worked, we want Saturday 18:00 - Sunday 24:00 as ONE zone
    console.log('\n📅 SUNDAY FREQUENCY CHECK (using combined weekend zones)')
    const sundayZonesForCounting = createCombinedSundayZones(planStartDate, planEndDate, plan.tariffavtale)
    
    const sundaysWorkedCount = sundayZonesForCounting.filter(zone => {
      let hasWork = false
      effectiveRotations.forEach(rotation => {
        if (!rotation.shift_id || hasWork) return
        const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
        
        const overlap = calculateTimeZoneOverlap(rotation, shift, zone, planStartDate)
        if (overlap > 0) {
          hasWork = true
        }
      })
      return hasWork
    }).length
    
    const totalSundays = sundayZonesForCounting.length
    const sundaysWorked = sundaysWorkedCount

    console.log(`  Total Sundays in period: ${totalSundays}`)
    console.log(`  Sundays worked: ${sundaysWorked}`)
    
    sundayZonesForCounting.forEach(zone => {
      let hasWork = false
      effectiveRotations.forEach(rotation => {
        if (!rotation.shift_id || hasWork) return
        const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
        if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
        
        const overlap = calculateTimeZoneOverlap(rotation, shift, zone, planStartDate)
        if (overlap > 0) {
          hasWork = true
        }
      })
      
      const status = hasWork ? '✓ WORKED' : '✗ not worked'
      console.log(`  ${formatDateLocal(zone.startDateTime)} - ${formatDateLocal(zone.endDateTime)}: ${status}`)
    })

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

    // Tariff night hours and total hours (NOW INCLUDING overlays)
    console.log(`\n🌙 TARIFF NIGHT HOURS (${plan.tariffavtale.toUpperCase()} – ${getNightHoursLabel(plan.tariffavtale)}) - Including overlays`)
    const calculateNightHours = getNightHoursCalculator(plan.tariffavtale)
    const nightHoursLabel = getNightHoursLabel(plan.tariffavtale)

    let totalHours = 0
    let totalNightHoursTariff = 0
    let overlayCount = 0
    let nonOverlayCount = 0

    effectiveRotations.forEach(rotation => {
      if (!rotation.shift_id) return
      const shift = effectiveShifts.find(s => s.id === rotation.shift_id)
      
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return
      
      const hasOverlay = rotation.overlay_shift_id !== null && rotation.overlay_shift_id !== undefined
      if (hasOverlay) {
        overlayCount++
      } else {
        nonOverlayCount++
      }

      const shiftHours = calculateShiftHours(shift.start_time, shift.end_time)
      const tariffNight = calculateNightHours(shift.start_time, shift.end_time)
      totalHours += shiftHours
      totalNightHoursTariff += tariffNight

      if (tariffNight > 0) {
        const overlayInfo = hasOverlay ? ' [HAS OVERLAY]' : ''
        console.log(
          `  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week}: ${shift.name} (${shift.start_time}-${shift.end_time}) → ${tariffNight.toFixed(2)}h night (${nightHoursLabel})${overlayInfo}`
        )
      }
    })

    console.log(`  → Total tariff night hours (including overlays): ${totalNightHoursTariff.toFixed(2)}h`)
    console.log(`  → Rotations with overlays: ${overlayCount}`)
    console.log(`  → Rotations without overlays: ${nonOverlayCount}`)

    const nonNightHours = totalHours - totalNightHoursTariff
    const nonNightPercent = totalHours > 0 ? (nonNightHours / totalHours) * 100 : 0
    const meetsNonNightRequirement = nonNightPercent >= requiredNonNightPercent

    // Adjust holiday hours by subtracting night hours that fall in zones
    const rawHolidayHoursBeforeAdjustment = totalHolidayHoursWorked
    console.log(`\n⚠️ HOLIDAY HOURS (no adjustment needed - overlays handle both night and zone):`)
    console.log(`  Holiday/Sunday hours (from zones): ${totalHolidayHoursWorked.toFixed(2)}h`)
    console.log(`  Note: Overlay subtractions will handle both night and zone hours automatically`)

    // Calculate F3/F4/F5/vacation hours to subtract based on checkbox settings
    // We need to subtract the TOTAL underlying hours for these overlays
    let hoursToSubtractFromFShifts = 0 // holiday zone hours
    let hoursToSubtractFromFShiftsNight = 0 // TOTAL night hours (not just in zones)
    let hoursToSubtractFromVacation = 0 // holiday zone hours
    let hoursToSubtractFromVacationNight = 0 // TOTAL night hours (not just in zones)

    console.log('\n📊 CALCULATING OVERLAY SUBTRACTIONS:')

    // Calculate total underlying hours for F3/F4/F5/vacation overlays
    effectiveRotations.forEach(rotation => {
      if (!rotation.overlay_shift_id) return
      
      const overlayShift = effectiveShifts.find(s => s.id === rotation.overlay_shift_id)
      if (!overlayShift || !overlayShift.is_default) return
      
      const underlyingShift = rotation.shift_id 
        ? effectiveShifts.find(s => s.id === rotation.shift_id)
        : null
      
      if (!underlyingShift || !underlyingShift.start_time || !underlyingShift.end_time) return
      
      // Calculate TOTAL night hours for this shift (for tariff night calculation)
      const underlayNightHours = calculateNightHours(underlyingShift.start_time, underlyingShift.end_time)
      
      // Calculate holiday zone overlap for this specific rotation
      let holidayZoneOverlap = 0
      relevantTimeZones.forEach(zone => {
        holidayZoneOverlap += calculateTimeZoneOverlap(rotation, underlyingShift, zone, planStartDate)
      })
      
      // Determine which type and if we should subtract based on checkbox
      const shouldSubtract = 
        (overlayShift.name === 'F3' && inputs.reduceByF3) ||
        (overlayShift.name === 'F4' && inputs.reduceByF4) ||
        (overlayShift.name === 'F5' && inputs.reduceByF5) ||
        (overlayShift.name === 'FE' && inputs.reduceByVacation)
      
      if (shouldSubtract) {
        console.log(`  Week ${rotation.week_index + 1}, Day ${rotation.day_of_week}: ${overlayShift.name} over ${underlyingShift.name} - Night: ${underlayNightHours.toFixed(2)}h, Zone overlap: ${holidayZoneOverlap.toFixed(2)}h`)
      }
      
      if (overlayShift.name === 'F3' && inputs.reduceByF3) {
        hoursToSubtractFromFShifts += holidayZoneOverlap
        hoursToSubtractFromFShiftsNight += underlayNightHours
      } else if (overlayShift.name === 'F4' && inputs.reduceByF4) {
        hoursToSubtractFromFShifts += holidayZoneOverlap
        hoursToSubtractFromFShiftsNight += underlayNightHours
      } else if (overlayShift.name === 'F5' && inputs.reduceByF5) {
        hoursToSubtractFromFShifts += holidayZoneOverlap
        hoursToSubtractFromFShiftsNight += underlayNightHours
      } else if (overlayShift.name === 'FE' && inputs.reduceByVacation) {
        hoursToSubtractFromVacation += holidayZoneOverlap
        hoursToSubtractFromVacationNight += underlayNightHours
      }
    })

    console.log('\n📊 TOTAL HOURS TO SUBTRACT (based on checkbox settings):')
    console.log(`  F3/F4/F5 holiday zone hours: ${hoursToSubtractFromFShifts.toFixed(2)}h`)
    console.log(`  F3/F4/F5 TOTAL night hours: ${hoursToSubtractFromFShiftsNight.toFixed(2)}h`)
    console.log(`  Vacation holiday zone hours: ${hoursToSubtractFromVacation.toFixed(2)}h`)
    console.log(`  Vacation TOTAL night hours: ${hoursToSubtractFromVacationNight.toFixed(2)}h`)
    console.log(`  COMBINED night hours to subtract: ${(hoursToSubtractFromFShiftsNight + hoursToSubtractFromVacationNight).toFixed(2)}h`)
    console.log(`  Expected AFTER subtraction: ${(totalNightHoursTariff - hoursToSubtractFromFShiftsNight - hoursToSubtractFromVacationNight).toFixed(2)}h`)

    // Calculate F3/F4/F5 overlay information for display
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
    
    console.log(`\n⚠️ OVERLAY INFORMATION (checkboxes control what gets subtracted):`)
    console.log(`  Total overlays found: ${overlayDays.length}`)
    console.log(`  Checkbox settings:`)
    console.log(`    - Reduce by F3: ${inputs.reduceByF3 ? 'YES' : 'NO'}`)
    console.log(`    - Reduce by F4: ${inputs.reduceByF4 ? 'YES' : 'NO'}`)
    console.log(`    - Reduce by F5: ${inputs.reduceByF5 ? 'YES' : 'NO'}`)
    console.log(`    - Reduce by Vacation: ${inputs.reduceByVacation ? 'YES' : 'NO'}`)
    console.log(`  Hours to subtract based on active checkboxes:`)
    console.log(`    - Holiday zone hours: ${hoursToSubtractFromFShifts + hoursToSubtractFromVacation}h`)
    console.log(`    - Night hours: ${hoursToSubtractFromFShiftsNight + hoursToSubtractFromVacationNight}h`)

    // Qualification checks
    const meetsNightHours35 = avgNightHoursPerWeek20to6 >= requiredNightHours
    const qualifiesFor35_5 = meetsNightHours35 || meetsSundayRequirement
    const qualifiesFor33_6 = has24HourCoverage && meetsSundayRequirement && meetsNonNightRequirement

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

    // Calculate adjusted weeks if vacation is being reduced
    let effectiveWeeks = actualWeeks
    if (inputs.reduceByVacation) {
      // Count ALL vacation days - both as overlays AND as main shifts
      // FE can be either:
      // 1. An overlay (rotation.overlay_shift_id points to FE)
      // 2. The main shift (rotation.shift_id points to FE, no overlay)
      const totalVacationDays = effectiveRotations.filter(rotation => {
        // Check if overlay is FE
        if (rotation.overlay_shift_id) {
          const overlayShift = effectiveShifts.find(s => s.id === rotation.overlay_shift_id)
          if (overlayShift && overlayShift.name === 'FE' && overlayShift.is_default) {
            return true
          }
        }
        
        // Check if main shift is FE (and there's no overlay on top)
        if (rotation.shift_id && !rotation.overlay_shift_id) {
          const mainShift = effectiveShifts.find(s => s.id === rotation.shift_id)
          if (mainShift && mainShift.name === 'FE' && mainShift.is_default) {
            return true
          }
        }
        
        return false
      }).length
      
      const vacationWeeks = totalVacationDays / 7
      effectiveWeeks = actualWeeks - vacationWeeks
      
      console.log(`\n📅 VACATION ADJUSTMENT:`)
      console.log(`  Plan weeks: ${actualWeeks}`)
      console.log(`  Vacation days (ALL FE - both overlay and main shift): ${totalVacationDays}`)
      console.log(`  Vacation weeks: ${vacationWeeks.toFixed(2)}`)
      console.log(`  Effective weeks (after vacation): ${effectiveWeeks.toFixed(2)}`)
    }

    if (qualifiesFor33_6) {
      // Use ADJUSTED hours (after subtracting F3/F4/F5/vacation)
      const adjustedNightHours = totalNightHoursTariff - hoursToSubtractFromFShiftsNight - hoursToSubtractFromVacationNight
      const adjustedHolidayHours = totalHolidayHoursWorked - hoursToSubtractFromFShifts - hoursToSubtractFromVacation

      // Calculate TOTAL credits
      reductionFromNightTotal = adjustedNightHours * 0.25
      reductionFromHolidayTotal = (adjustedHolidayHours * (10 / 60))
      
      // Scale holiday by work percent BEFORE dividing by weeks
      const holidayCreditScaled = reductionFromHolidayTotal * workPercentFactor
      
      // Now divide by effective weeks
      reductionFromNight = reductionFromNightTotal / effectiveWeeks
      reductionFromHoliday = reductionFromHolidayTotal / effectiveWeeks
      reductionFromHolidayPostPercent = holidayCreditScaled / effectiveWeeks

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
      
      // Use ADJUSTED hours (after subtracting F3/F4/F5/vacation)
      const adjustedNightHours = totalNightHoursTariff - hoursToSubtractFromFShiftsNight - hoursToSubtractFromVacationNight
      const adjustedHolidayHours = totalHolidayHoursWorked - hoursToSubtractFromFShifts - hoursToSubtractFromVacation
      
      reductionFromNight = adjustedNightHours * 0.25
      reductionFromHoliday = adjustedHolidayHours * (10 / 60)
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
      effectiveWeeks: effectiveWeeks,
      planWorkPercent: plan.work_percent,
      hoursToSubtractFromFShifts,
      hoursToSubtractFromFShiftsNight,
      hoursToSubtractFromVacation,
      hoursToSubtractFromVacationNight,
      nightHoursInHolidayZones: 0, // No longer used, set to 0
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
        description: 'Kvalifiserer ikkje for 35,5t/veke eller 3-delt snitt. Du kan vere kvalifisert som turnusarbeidar med 37,5t arbeidsveke. Så du har rett på tillegg frå Tariffavtalen.'
      }]
    }

    return result
  }
}