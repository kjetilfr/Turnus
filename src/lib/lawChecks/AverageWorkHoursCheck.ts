// src/lib/lawChecks/AverageWorkHoursCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'

/**
 * Gjennomsnittsberegning (Average Work Hours Calculation)
 * Checks compliance with average working hours regulations based on agreement type
 */
export const averageWorkHoursCheck: LawCheck = {
  id: 'average-work-hours',
  name: 'Gjennomsnittsberegning',
  description: 'Verifiserer at gjennomsnittleg arbeidstid vert overhaldne basert på avtaletype. Standard er 35,5 t/veke med tariffavtale i turnus. 37.5 t/veke utan turnusarbeid. 40 t/veka utan tariffavtale. Standard er at du har tariffavtale og jobbar turnus',
  category: 'shared',
  lawType: 'aml',
  lawReferences: [
    {
      title: 'AML §10-4 - Alminnelig arbeidstid',
      url: 'https://lovdata.no/lov/2005-06-17-62/§10-4'
    },
    {
      title: 'AML §10-5 - Gjennomsnittlig beregning',
      url: 'https://lovdata.no/lov/2005-06-17-62/§10-5'
    },
    {
      title: 'AML § 10-12 (4).Unntak',
      url: 'https://lovdata.no/lov/2005-06-17-62/§10-12'
    }
  ],
  applicableTo: ['main', 'helping', 'year'],
  inputs: [
    {
      id: 'agreementType',
      label: 'Avtaletype',
      type: 'text',
      defaultValue: 'type2' // Change this to: 'none', 'type1', 'type2', 'type3', or 'type4'
    },
    // Standard (No Agreement)
    {
      id: 'standardMaxShiftHours',
      label: 'Maksimum vakt lengde',
      type: 'number',
      defaultValue: 9,
      min: 1,
      max: 24,
      step: 0.5,
      unit: 'timar'
    },
    {
      id: 'standardMaxWeeklyHours',
      label: 'Maksimum timar per veke',
      type: 'number',
      defaultValue: 35.5,
      min: 1,
      max: 100,
      step: 0.5,
      unit: 'timar'
    },
    // Type 1: Employer-Employee Agreement
    {
      id: 'type1MaxShiftHours',
      label: 'Maksimum vakt lengde',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 24,
      step: 0.5,
      unit: 'timar'
    },
    {
      id: 'type1MaxWeeklyHours',
      label: 'Maksimum timar per veke',
      type: 'number',
      defaultValue: 50,
      min: 1,
      max: 100,
      step: 0.5,
      unit: 'timar'
    },
    {
      id: 'type1Max8WeekHours',
      label: 'Maksimum timar per veke, over 8-veker',
      type: 'number',
      defaultValue: 48,
      min: 1,
      max: 100,
      step: 0.5,
      unit: 'timar/veke gjennomsnitt'
    },
    // Type 2: Employer-Representative Agreement
    {
      id: 'type2MaxShiftHours',
      label: 'Maksimum vakt lengde',
      type: 'number',
      defaultValue: 12.5,
      min: 1,
      max: 24,
      step: 0.5,
      unit: 'timar'
    },
    {
      id: 'type2MaxWeeklyHours',
      label: 'Maksimum timar per veke',
      type: 'number',
      defaultValue: 54,
      min: 1,
      max: 100,
      step: 0.5,
      unit: 'timar'
    },
    {
      id: 'type2Max8WeekHours',
      label: 'Maksimum timar per veke, over 8-veker',
      type: 'number',
      defaultValue: 48,
      min: 1,
      max: 100,
      step: 0.5,
      unit: 'timar/veke gjennomsnitt'
    },
    // Type 3: Arbeidstilsynet Agreement
    {
      id: 'type3MaxShiftHours',
      label: 'Maksimum vakt lengde',
      type: 'number',
      defaultValue: 13,
      min: 1,
      max: 24,
      step: 0.5,
      unit: 'timar'
    },
    {
      id: 'type3Max8WeekHours',
      label: 'Maksimum timar per veke, over 8-veker',
      type: 'number',
      defaultValue: 48,
      min: 1,
      max: 100,
      step: 0.5,
      unit: 'timar/veke gjennomsnitt'
    },
    // Type 4: Union Agreement
    {
      id: 'type4MaxShiftHours',
      label: 'Maksimum vakt lengde',
      type: 'number',
      defaultValue: 14.5,
      min: 1,
      max: 24,
      step: 0.5,
      unit: 'timar'
    },
    {
      id: 'type4MaxWeeklyHours',
      label: 'Maksimum timar per veke',
      type: 'number',
      defaultValue: 54,
      min: 1,
      max: 100,
      step: 0.5,
      unit: 'timar'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const agreementType = (inputs.agreementType as string) || 'none'
    const result: LawCheckResult = {
      status: 'pass',
      message: '',
      details: [],
      violations: []
    }

    // Get limits based on agreement type
    let maxShiftHours: number
    let maxWeeklyHours: number | null
    let max8WeekAvgHours: number | null
    let agreementName: string

    switch (agreementType) {
      case 'type1':
        maxShiftHours = (inputs.type1MaxShiftHours as number) || 10
        maxWeeklyHours = (inputs.type1MaxWeeklyHours as number) || 50
        max8WeekAvgHours = (inputs.type1Max8WeekHours as number) || 48
        agreementName = 'Avtale med arbeidstakar'
        break
      case 'type2':
        maxShiftHours = (inputs.type2MaxShiftHours as number) || 12.5
        maxWeeklyHours = (inputs.type2MaxWeeklyHours as number) || 54
        max8WeekAvgHours = (inputs.type2Max8WeekHours as number) || 48
        agreementName = 'Avtale med tillitsvalgte'
        break
      case 'type3':
        maxShiftHours = (inputs.type3MaxShiftHours as number) || 13
        maxWeeklyHours = null // No weekly max for Type 3
        max8WeekAvgHours = (inputs.type3Max8WeekHours as number) || 48
        agreementName = 'Avtale med arbeidstilsynet'
        break
      case 'type4':
        maxShiftHours = (inputs.type4MaxShiftHours as number) || 14.5
        maxWeeklyHours = (inputs.type4MaxWeeklyHours as number) || 54
        max8WeekAvgHours = null // No 8-week limit for Type 4
        agreementName = 'Avtale med forbund sentralt'
        break
      default: // 'none' - Standard
        maxShiftHours = (inputs.standardMaxShiftHours as number) || 9
        maxWeeklyHours = (inputs.standardMaxWeeklyHours as number) || 35.5
        max8WeekAvgHours = null
        agreementName = 'Ingen avtale (kun aml)'
    }

    // Build weekly hours map
    const weeklyHours: Record<number, number> = {}
    for (let week = 0; week < plan.duration_weeks; week++) {
      weeklyHours[week] = 0
    }

    // Check shift lengths and calculate weekly hours
    const shiftViolations: Array<{ week: number; day: number; hours: number }> = []
    
    rotations.forEach((rotation: Rotation) => {
      if (rotation.shift_id) {
        const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
        if (shift && shift.start_time && shift.end_time) {
          const shiftHours = calculateShiftHours(shift.start_time, shift.end_time)
          
          // Check shift length
          if (shiftHours > maxShiftHours) {
            shiftViolations.push({
              week: rotation.week_index,
              day: rotation.day_of_week,
              hours: shiftHours
            })
            result.violations?.push({
              weekIndex: rotation.week_index,
              dayOfWeek: rotation.day_of_week,
              description: `Vakt lengde ${shiftHours.toFixed(2)}t overskrid maksimum på ${maxShiftHours}t`
            })
          }
          
          // Add to weekly total
          weeklyHours[rotation.week_index] += shiftHours
        }
      }
    })

    // Check weekly hours
    const weeklyViolations: Array<{ week: number; hours: number }> = []
    
    if (maxWeeklyHours !== null) {
      for (let week = 0; week < plan.duration_weeks; week++) {
        if (weeklyHours[week] > maxWeeklyHours) {
          weeklyViolations.push({
            week,
            hours: weeklyHours[week]
          })
          result.violations?.push({
            weekIndex: week,
            dayOfWeek: -1,
            description: `Veke timar ${weeklyHours[week].toFixed(1)}t overksrid maksimum på ${maxWeeklyHours}t`
          })
        }
      }
    }

    // Check 8-week average
    const eightWeekViolations: Array<{ startWeek: number; avgHours: number }> = []
    
    if (max8WeekAvgHours !== null && plan.duration_weeks >= 8) {
      for (let startWeek = 0; startWeek <= plan.duration_weeks - 8; startWeek++) {
        let total = 0
        for (let i = 0; i < 8; i++) {
          total += weeklyHours[startWeek + i]
        }
        const avg = total / 8
        
        if (avg > max8WeekAvgHours) {
          eightWeekViolations.push({
            startWeek,
            avgHours: avg
          })
          result.violations?.push({
            weekIndex: startWeek,
            dayOfWeek: -1,
            description: `8-vekers gjennomsnitt ${avg.toFixed(1)}t/veka overskrid maksimum på ${max8WeekAvgHours}t/veka (veker ${startWeek + 1}-${startWeek + 8})`
          })
        }
      }
    }

    // Build result
    const dayNames = ['Man', 'Tys', 'Ons', 'Tor', 'Fre', 'Lau', 'Søn']
    
    if (shiftViolations.length > 0 || weeklyViolations.length > 0 || eightWeekViolations.length > 0) {
      result.status = 'fail'
      result.message = `Turnusen er ikkje godkjend med "${agreementName}" sine begrensingar`
      
      if (shiftViolations.length > 0) {
        result.details?.push(`Shift length violations: ${shiftViolations.length}`)
        shiftViolations.forEach(v => {
          result.details?.push(
            `  Week ${v.week + 1}, ${dayNames[v.day]}: ${v.hours.toFixed(1)}h shift (max ${maxShiftHours}h)`
          )
        })
      }
      
      if (weeklyViolations.length > 0) {
        result.details?.push(`Weekly hours violations: ${weeklyViolations.length}`)
        weeklyViolations.forEach(v => {
          result.details?.push(
            `  Week ${v.week + 1}: ${v.hours.toFixed(1)}h (max ${maxWeeklyHours}h)`
          )
        })
      }
      
      if (eightWeekViolations.length > 0) {
        result.details?.push(`8-week average violations: ${eightWeekViolations.length}`)
        eightWeekViolations.forEach(v => {
          result.details?.push(
            `  Weeks ${v.startWeek + 1}-${v.startWeek + 8}: ${v.avgHours.toFixed(1)}h/week avg (max ${max8WeekAvgHours}h/week)`
          )
        })
      }
    } else {
      result.status = 'pass'
      result.message = `Alle timar stemmer overeins med "${agreementName}" sine begrensingar`
      result.details = [
        `Agreement: ${agreementName}`,
        `Max shift length: ${maxShiftHours}h`,
        maxWeeklyHours !== null ? `Max weekly hours: ${maxWeeklyHours}h` : 'No weekly hour limit',
        max8WeekAvgHours !== null ? `Max 8-week average: ${max8WeekAvgHours}h/week` : 'No 8-week average limit',
        'All shifts and hours are within limits'
      ]
    }

    return result
  }
}