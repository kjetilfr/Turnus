// src/components/plan/CompactScheduleStatistics.tsx
'use client'

import type { Plan, Rotation } from '@/types/scheduler'

interface CompactScheduleStatisticsProps {
  plan: Plan
  rotations: Rotation[]
}

export default function CompactScheduleStatistics({ plan, rotations }: CompactScheduleStatisticsProps) {
  const calculateShiftDuration = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}:00`)
    let end = new Date(`2000-01-01T${endTime}:00`)
    
    if (end <= start) {
      end = new Date(`2000-01-02T${endTime}:00`)
    }
    
    const diffMs = end.getTime() - start.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return diffHours
  }

  // Calculate total hours across all weeks
  const totalPlanHours = rotations
    .filter(r => r.shift && r.shift_id)
    .reduce((total, r) => {
      if (r.shift) {
        return total + calculateShiftDuration(r.shift.start_time, r.shift.end_time)
      }
      return total
    }, 0)

  // Count total shifts assigned across all weeks
  const totalShiftsAssigned = rotations.filter(r => r.shift_id).length

  // Calculate total possible shifts (7 days × number of weeks)
  const totalPossibleShifts = 7 * plan.duration_weeks

  // Calculate days off
  const totalDaysOff = totalPossibleShifts - totalShiftsAssigned

  // Calculate average weekly hours
  const avgWeeklyHours = totalPlanHours / plan.duration_weeks

  // Calculate shifts per week breakdown
  const shiftsPerWeek = Array.from({ length: plan.duration_weeks }, (_, weekIndex) => {
    const weekShifts = rotations.filter(r => r.week_index === weekIndex && r.shift_id).length
    const weekHours = rotations
      .filter(r => r.week_index === weekIndex && r.shift)
      .reduce((total, r) => {
        if (r.shift) {
          return total + calculateShiftDuration(r.shift.start_time, r.shift.end_time)
        }
        return total
      }, 0)
    return { shifts: weekShifts, hours: weekHours }
  })

  // Find most/least busy weeks
  const maxShiftsInWeek = Math.max(...shiftsPerWeek.map(w => w.shifts), 0)
  const minShiftsInWeek = Math.min(...shiftsPerWeek.map(w => w.shifts), 7)

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Schedule Statistics</h3>
      </div>
      
      <div className="p-3">
        {/* Main Statistics - Compact Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center bg-gray-50 dark:bg-gray-700 rounded p-2">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {totalShiftsAssigned}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Shifts</div>
          </div>
          <div className="text-center bg-gray-50 dark:bg-gray-700 rounded p-2">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {totalPlanHours.toFixed(0)}h
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center bg-gray-50 dark:bg-gray-700 rounded p-2">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {totalDaysOff}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Days Off</div>
          </div>
          <div className="text-center bg-gray-50 dark:bg-gray-700 rounded p-2">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {avgWeeklyHours.toFixed(0)}h
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg/Week</div>
          </div>
        </div>

        {/* Weekly Breakdown - Table format */}
        {plan.duration_weeks > 1 && (
          <div>
            <h4 className="text-xs font-medium text-gray-900 dark:text-white mb-2">Weekly Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-2 py-1 text-left font-medium text-gray-900 dark:text-white">Week</th>
                    <th className="px-2 py-1 text-center font-medium text-gray-900 dark:text-white">Shifts</th>
                    <th className="px-2 py-1 text-center font-medium text-gray-900 dark:text-white">Hours</th>
                    <th className="px-2 py-1 text-center font-medium text-gray-900 dark:text-white">Days Off</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsPerWeek.map((week, weekIndex) => (
                    <tr key={weekIndex} className={`border-b border-gray-100 dark:border-gray-700 ${weekIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750/50'}`}>
                      <td className="px-2 py-1 font-medium text-gray-900 dark:text-white">
                        {weekIndex + 1}
                      </td>
                      <td className="px-2 py-1 text-center text-gray-600 dark:text-gray-300">
                        {week.shifts}
                      </td>
                      <td className="px-2 py-1 text-center text-gray-600 dark:text-gray-300">
                        {week.hours.toFixed(1)}h
                      </td>
                      <td className="px-2 py-1 text-center text-gray-500 dark:text-gray-400">
                        {7 - week.shifts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Summary stats for multi-week plans */}
            {plan.duration_weeks > 2 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="text-center bg-red-50 dark:bg-red-900/20 rounded p-2">
                  <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {maxShiftsInWeek}
                  </div>
                  <div className="text-xs text-red-500 dark:text-red-400">Most shifts/week</div>
                </div>
                <div className="text-center bg-green-50 dark:bg-green-900/20 rounded p-2">
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {minShiftsInWeek}
                  </div>
                  <div className="text-xs text-green-500 dark:text-green-400">Fewest shifts/week</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}