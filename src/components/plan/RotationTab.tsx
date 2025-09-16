// src/components/plan/RotationTab.tsx
'use client'

import type { Plan, Shift, Rotation } from '@/types/scheduler'
import EnhancedRotationGrid from './EnhancedRotationGrid'
import ScheduleStatistics from './ScheduleStatistics'

interface RotationTabProps {
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
  onUpdateRotation: (weekIndex: number, dayOfWeek: number, shiftId: string | null) => void
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
            Individual Day Schedule
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Assign different shifts to each day across {plan.duration_weeks} week{plan.duration_weeks !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Enhanced Rotation Grid for Individual Day Assignment */}
      <EnhancedRotationGrid
        plan={plan}
        shifts={shifts}
        rotations={rotations}
        onUpdateRotation={onUpdateRotation}
      />

      {/* Schedule Statistics */}
      <ScheduleStatistics
        plan={plan}
        rotations={rotations}
      />

      {/* Additional Tools */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schedule Tools</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Useful tools for managing your schedule
          </p>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (confirm('This will remove all shift assignments from your schedule. Continue?')) {
                  // Clear all rotations - this would need to be implemented in the parent
                  console.log('Clear all assignments requested')
                }
              }}
              className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-700 rounded-md text-sm font-medium text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
            >
              Clear All Assignments
            </button>
            
            <button
              onClick={() => {
                // Copy week 1 to all other weeks - this would need to be implemented in the parent
                console.log('Copy first week pattern requested')
              }}
              className="inline-flex items-center px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-md text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Copy Week 1 to All Weeks
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}