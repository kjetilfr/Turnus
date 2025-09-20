// src/components/plan/ScheduleStatistics.tsx - Updated with compact mode support
'use client'

import { useCompactMode } from '@/lib/compact-mode-context'
import CompactScheduleStatistics from './CompactScheduleStatistics'
import type { Plan, Rotation } from '@/types/scheduler'

interface ScheduleStatisticsProps {
  plan: Plan
  rotations: Rotation[]
}

export default function ScheduleStatistics({ plan, rotations }: ScheduleStatisticsProps) {
  const { compactMode } = useCompactMode()

  // Use compact statistics if compact mode is enabled
  if (compactMode) {
    return <CompactScheduleStatistics plan={plan} rotations={rotations} />
  }

  // Original statistics layout
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
    return rotations.filter(r => r.week_index === weekIndex && r.shift_id).length
  })

  // Find most/least busy weeks
  const maxShiftsInWeek = Math.max(...shiftsPerWeek, 0)
  const minShiftsInWeek = Math.min(...shiftsPerWeek, 7)

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schedule Statistics</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Overview of your {plan.duration_weeks}-week schedule plan
        </p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalShiftsAssigned}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total shifts assigned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {totalPlanHours.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total plan hours</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {totalDaysOff}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total days off</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {avgWeeklyHours.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg weekly hours</div>
          </div>
        </div>

        {plan.duration_weeks > 1 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Weekly Breakdown</h4>
            <div className="space-y-2">
              {shiftsPerWeek.map((shifts, weekIndex) => {
                const weekHours = rotations
                  .filter(r => r.week_index === weekIndex && r.shift)
                  .reduce((total, r) => {
                    if (r.shift) {
                      return total + calculateShiftDuration(r.shift.start_time, r.shift.end_time)
                    }
                    return total
                  }, 0)

                return (
                  <div key={weekIndex} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Week {weekIndex + 1}
                    </span>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                      <span>{shifts} shift{shifts !== 1 ? 's' : ''}</span>
                      <span>{weekHours.toFixed(1)}h</span>
                      <span className="text-xs text-gray-500">
                        {7 - shifts} day{7 - shifts !== 1 ? 's' : ''} off
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {plan.duration_weeks > 2 && (
              <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {maxShiftsInWeek}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Most shifts in a week</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {minShiftsInWeek}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Fewest shifts in a week</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}