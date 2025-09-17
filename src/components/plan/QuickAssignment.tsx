// src/components/plan/QuickAssignment.tsx
'use client'

import { DAYS_OF_WEEK } from '@/lib/constants'
import type { Shift, Rotation } from '@/types/scheduler'

interface QuickAssignmentProps {
  shifts: Shift[]
  rotations: Rotation[]
  onRotationUpdate: (dayOfWeek: number, shiftId: string | null) => Promise<void>
}

// Helper function to check if a shift is an F shift (F1-F5)
function isFShift(shift: Shift): boolean {
  return /^f[1-5]$/i.test(shift.name.trim())
}

export default function QuickAssignment({ 
  shifts, 
  rotations, 
  onRotationUpdate 
}: QuickAssignmentProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    return `${hours.padStart(2, '0')}:${minutes}`
  }

  const getRotationForDay = (dayOfWeek: number) => {
    return rotations.find(r => r.day_of_week === dayOfWeek)
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Quick Assignment</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Set the same shift for all weeks of a specific day
        </p>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => {
            const dayRotation = getRotationForDay(day.id)
            const assignedShift = dayRotation?.shift
            const isSunday = day.id === 0
            const isAssignedFShift = assignedShift && isFShift(assignedShift)
            
            return (
              <div key={day.id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <span className={`w-20 text-sm font-medium ${
                    isSunday 
                      ? 'text-red-700 dark:text-red-300' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {day.name}
                  </span>
                  {assignedShift && (
                    <div className={`flex items-center space-x-2 ${isAssignedFShift ? 'opacity-75' : ''}`}>
                      <div
                        className={`w-3 h-3 rounded-full ${isAssignedFShift ? 'opacity-60' : ''}`}
                        style={{ backgroundColor: assignedShift.color }}
                      />
                      <span className={`text-sm text-gray-600 dark:text-gray-300 ${isAssignedFShift ? 'opacity-75' : ''}`}>
                        {assignedShift.name}
                      </span>
                      {!isAssignedFShift && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({formatTime(assignedShift.start_time)} - {formatTime(assignedShift.end_time)})
                        </span>
                      )}
                      {isAssignedFShift && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 opacity-75">
                          (times not used)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={dayRotation?.shift_id || ''}
                    onChange={(e) => onRotationUpdate(day.id, e.target.value || null)}
                    className="block w-48 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  >
                    <option value="">No shift</option>
                    {shifts.map((shift) => {
                      const isShiftFShift = isFShift(shift)
                      return (
                        <option key={shift.id} value={shift.id}>
                          {shift.name} {!isShiftFShift ? `(${formatTime(shift.start_time)} - ${formatTime(shift.end_time)})` : '(F shift)'}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}