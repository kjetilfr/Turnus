// src/components/rotation/ShiftSummary.tsx
'use client'

import { useMemo } from 'react'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { calculateShiftHours } from '@/lib/utils/shiftCalculations'

interface ShiftSummaryProps {
  rotations: Rotation[]
  shifts: Shift[]
}

interface ShiftStats {
  shift: Shift
  count: number
  totalHours: number
}

export default function ShiftSummary({ rotations, shifts }: ShiftSummaryProps) {
  // Calculate statistics for each shift
  const shiftStats = useMemo(() => {
    const statsMap = new Map<string, ShiftStats>()
    
    // Initialize all shifts with zero count
    shifts.forEach(shift => {
      statsMap.set(shift.id, {
        shift,
        count: 0,
        totalHours: 0
      })
    })
    
    // Count occurrences and calculate total hours
    rotations.forEach(rotation => {
      if (rotation.shift_id) {
        const stats = statsMap.get(rotation.shift_id)
        if (stats) {
          const shiftHours = calculateShiftHours(stats.shift.start_time, stats.shift.end_time)
          stats.count++
          stats.totalHours += shiftHours
        }
      }
    })
    
    // Convert to array and sort by shift name
    return Array.from(statsMap.values())
      .sort((a, b) => {
        // Sort default shifts first, then by name
        if (a.shift.is_default && !b.shift.is_default) return -1
        if (!a.shift.is_default && b.shift.is_default) return 1
        return a.shift.name.localeCompare(b.shift.name)
      })
  }, [rotations, shifts])

  const defaultShiftStats = shiftStats.filter(s => s.shift.is_default)
  const customShiftStats = shiftStats.filter(s => !s.shift.is_default)

  const formatTime = (time: string | null) => {
    if (!time) return '-'
    return time.substring(0, 5)
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const totalShifts = shiftStats.reduce((sum, stat) => sum + stat.count, 0)
  const totalHours = shiftStats.reduce((sum, stat) => sum + stat.totalHours, 0)

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Shift Summary</h2>
        <p className="text-sm text-gray-600 mt-1">Overview of all shifts in this plan</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Time Period
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Count
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Total Hours
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Default Shifts */}
            {defaultShiftStats.length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td colSpan={6} className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Default Shifts
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
                        {formatTime(stat.shift.start_time)} - {formatTime(stat.shift.end_time)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-medium">
                        {formatDuration(shiftHours)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {stat.count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {stat.totalHours.toFixed(2)}h
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
                  <td colSpan={6} className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Custom Shifts
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
                        {formatTime(stat.shift.start_time)} - {formatTime(stat.shift.end_time)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-medium">
                        {formatDuration(shiftHours)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {stat.count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center font-semibold">
                        {stat.totalHours.toFixed(2)}h
                      </td>
                    </tr>
                  )
                })}
              </>
            )}

            {/* Total Row */}
            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
              <td className="px-6 py-4 text-sm font-bold text-gray-900" colSpan={4}>
                TOTAL
              </td>
              <td className="px-6 py-4 text-sm font-bold text-indigo-900 text-center">
                {totalShifts}
              </td>
              <td className="px-6 py-4 text-sm font-bold text-indigo-900 text-center">
                {totalHours.toFixed(2)}h
              </td>
            </tr>
          </tbody>
        </table>

        {shiftStats.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            <p>No shifts found in this plan.</p>
          </div>
        )}
      </div>
    </div>
  )
}