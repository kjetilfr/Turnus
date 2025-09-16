// src/components/plan/ScheduleStatistics.tsx
'use client'

import type { Plan, Rotation } from '@/types/scheduler'

interface ScheduleStatisticsProps {
  plan: Plan
  rotations: Rotation[]
}

export default function ScheduleStatistics({ plan, rotations }: ScheduleStatisticsProps) {
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

  const totalPlanHours = rotations
    .filter(r => r.shift && r.shift_id)
    .reduce((total, r) => {
      if (r.shift) {
        return total + calculateShiftDuration(r.shift.start_time, r.shift.end_time)
      }
      return total
    }, 0) * plan.duration_weeks

  const daysWithShifts = rotations.filter(r => r.shift_id).length
  const totalDaysOff = (7 - daysWithShifts) * plan.duration_weeks
  const avgWeeklyHours = totalPlanHours / plan.duration_weeks

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schedule Statistics</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {daysWithShifts}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Days with shifts</div>
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
      </div>
    </div>
  )
}