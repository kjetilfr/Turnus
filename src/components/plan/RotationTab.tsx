// src/components/plan/RotationTab.tsx
'use client'

import type { Plan, Shift, Rotation } from '@/types/scheduler'
import RotationGrid from './RotationGrid'
import QuickAssignment from './QuickAssignment'
import ScheduleStatistics from './ScheduleStatistics'

interface RotationTabProps {
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
  onUpdateRotation: (dayOfWeek: number, shiftId: string | null) => void
  onSwitchToShifts: () => void
}

export default function RotationTab({ 
  plan, 
  shifts, 
  rotations, 
  onUpdateRotation, 
  onSwitchToShifts 
}: RotationTabProps) {
  if (shifts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {plan.duration_weeks > 1 ? `${plan.duration_weeks}-Week Rotation` : 'Weekly Rotation'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Plan duration: {plan.duration_weeks} week{plan.duration_weeks !== 1 ? 's' : ''}
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create shifts first to set up rotations
          </p>
        </div>

        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No shifts available</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You need to create shifts before setting up rotations.
          </p>
          <div className="mt-6">
            <button
              onClick={onSwitchToShifts}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Go to Shifts
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {plan.duration_weeks > 1 ? `${plan.duration_weeks}-Week Rotation` : 'Weekly Rotation'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Plan duration: {plan.duration_weeks} week{plan.duration_weeks !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Multi-Week Schedule Grid */}
      <RotationGrid
        plan={plan}
        shifts={shifts}
        rotations={rotations}
        onUpdateRotation={onUpdateRotation}
      />

      {/* Quick Assignment Panel */}
      <QuickAssignment
        shifts={shifts}
        rotations={rotations}
        onUpdateRotation={onUpdateRotation}
      />

      {/* Schedule Statistics */}
      <ScheduleStatistics
        plan={plan}
        rotations={rotations}
      />
    </div>
  )
}