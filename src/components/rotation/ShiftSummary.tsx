// src/components/rotation/ShiftSummary.tsx
'use client'

import { useMemo } from 'react'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'
import { calculateEveningHours, calculateWeekendHours, getNightHoursLabel, getNightHoursCalculator } from '@/lib/utils/shiftTimePeriods'


interface ShiftSummaryProps {
  rotations: Rotation[]
  shifts: Shift[]
  plan: Plan
  planType: 'main' | 'helping' | 'year'
}

interface ShiftStats {
  shift: Shift
  count: number
  totalHours: number
  eveningHours: number
  nightHours: number
  weekendHours: number
}

export default function ShiftSummary({ rotations, shifts, plan, planType }: ShiftSummaryProps) {
  const calculateNightHours = getNightHoursCalculator(plan.tariffavtale) // Now uses imported function
  const nightHoursLabel = getNightHoursLabel(plan.tariffavtale)

  // Calculate statistics for each shift
  const shiftStats = useMemo(() => {
    const statsMap = new Map<string, ShiftStats>()
    
    // Initialize all shifts with zero count
    shifts.forEach(shift => {
      statsMap.set(shift.id, {
        shift,
        count: 0,
        totalHours: 0,
        eveningHours: 0,
        nightHours: 0,
        weekendHours: 0,
      })
    })
    
    // Count occurrences and calculate total hours
    rotations.forEach(rotation => {
      if (rotation.shift_id) {
        const stats = statsMap.get(rotation.shift_id)
        if (stats) {
          const shiftHours = calculateShiftHours(stats.shift.start_time, stats.shift.end_time)
          const eveningHours = calculateEveningHours(stats.shift.start_time, stats.shift.end_time)
          const nightHours = calculateNightHours(stats.shift.start_time, stats.shift.end_time)
          const weekendHours = calculateWeekendHours(stats.shift.start_time, stats.shift.end_time, rotation.day_of_week)
          
          stats.count++
          stats.totalHours += shiftHours
          stats.eveningHours += eveningHours
          stats.nightHours += nightHours
          stats.weekendHours += weekendHours
        }
      }
    })
    
    // Filter and sort based on plan type
    return Array.from(statsMap.values())
      .filter(stat => {
        //FIRST: Filter out shifts with zero count
        if (stat.count === 0) return false
        
        // For main plans, exclude all F shifts
        if (planType === 'main' && stat.shift.is_default) {
          return false
        }
        // For helping/year plans, exclude F shifts that aren't used
        if ((planType === 'helping' || planType === 'year') && stat.shift.is_default) {
          // Only include F3-F5 if they're actually used
          if (['F3', 'F4', 'F5'].includes(stat.shift.name)) {
            return stat.count > 0
          }
          // Exclude F1 and F2 always for helping/year plans
          return false
        }
        return true
      })
      .sort((a, b) => {
        // Sort default shifts first, then by name
        if (a.shift.is_default && !b.shift.is_default) return -1
        if (!a.shift.is_default && b.shift.is_default) return 1
        return a.shift.name.localeCompare(b.shift.name)
      })
  }, [rotations, shifts, planType, calculateNightHours])

  const defaultShiftStats = shiftStats.filter(s => s.shift.is_default)
  const customShiftStats = shiftStats.filter(s => !s.shift.is_default)

  const formatTime = (time: string | null) => {
    if (!time) return '-'
    return time.substring(0, 5)
  }

  const formatHours = (hours: number) => {
    return `${hours.toFixed(2)}t`
  }

  const totalShifts = shiftStats.reduce((sum, stat) => sum + stat.count, 0)
  const totalHours = shiftStats.reduce((sum, stat) => sum + stat.totalHours, 0)
  const totalEveningHours = shiftStats.reduce((sum, stat) => sum + stat.eveningHours, 0)
  const totalNightHours = shiftStats.reduce((sum, stat) => sum + stat.nightHours, 0)
  const totalWeekendHours = shiftStats.reduce((sum, stat) => sum + stat.weekendHours, 0)

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Turnus oppsummering</h2>
        <p className="text-sm text-gray-600 mt-1">
          Oversikt over alle vakter i turnus • Natt timar: {nightHoursLabel} ({plan.tariffavtale.toUpperCase()})
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Namn
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Beskrivelse
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Frå - Til (Varigheit)
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Tal
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Totale Timar
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Kveld
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Natt ({nightHoursLabel})
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Lau/Søn
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Default Shifts (only F3-F5 for helping/year plans if used) */}
            {defaultShiftStats.length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td colSpan={8} className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Forhandsinnstilte vakter
                  </td>
                </tr>
                {defaultShiftStats.map((stat) => {
                  const shiftHours = calculateShiftHours(stat.shift.start_time, stat.shift.end_time)
                  return (
                    <tr key={stat.shift.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {stat.shift.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {stat.shift.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {formatTime(stat.shift.start_time)} - {formatTime(stat.shift.end_time)} ({formatHours(shiftHours)})
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {stat.count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {formatHours(stat.totalHours)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {formatHours(stat.eveningHours)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {formatHours(stat.nightHours)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {formatHours(stat.weekendHours)}
                      </td>
                    </tr>
                  )
                })}
              </>
            )}

            {/* Custom Shifts */}
            {customShiftStats.length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td colSpan={8} className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Eigendefinerte vakter
                  </td>
                </tr>
                {customShiftStats.map((stat) => {
                  const shiftHours = calculateShiftHours(stat.shift.start_time, stat.shift.end_time)
                  return (
                    <tr key={stat.shift.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {stat.shift.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {stat.shift.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {formatTime(stat.shift.start_time)} - {formatTime(stat.shift.end_time)} ({formatHours(shiftHours)})
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {stat.count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {formatHours(stat.totalHours)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {formatHours(stat.eveningHours)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {formatHours(stat.nightHours)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {formatHours(stat.weekendHours)}
                      </td>
                    </tr>
                  )
                })}
              </>
            )}

            {/* Total Row */}
            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
              <td className="px-6 py-4 text-sm font-bold text-gray-900" colSpan={3}>
                TOTAL
              </td>
              <td className="px-6 py-4 text-sm font-bold text-indigo-900 text-center">
                {totalShifts}
              </td>
              <td className="px-6 py-4 text-sm font-bold text-indigo-900 text-center">
                {formatHours(totalHours)}
              </td>
              <td className="px-6 py-4 text-sm font-bold text-indigo-900 text-center">
                {formatHours(totalEveningHours)}
              </td>
              <td className="px-6 py-4 text-sm font-bold text-indigo-900 text-center">
                {formatHours(totalNightHours)}
              </td>
              <td className="px-6 py-4 text-sm font-bold text-indigo-900 text-center">
                {formatHours(totalWeekendHours)}
              </td>
            </tr>
          </tbody>
        </table>

        {shiftStats.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            <p>Ingen vakter i turnus.</p>
          </div>
        )}
      </div>
    </div>
  )
}