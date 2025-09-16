// src/components/plan/QuickAssignment.tsx
'use client'

import type { Shift, Rotation } from '@/types/scheduler'

const DAYS_OF_WEEK = [
  { id: 0, name: 'Sunday', short: 'Sun' },
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
]

interface QuickAssignmentProps {
  shifts: Shift[]
  rotations: Rotation[]
  onUpdateRotation: (dayOfWeek: number, shiftId: string | null) => void
}

export default function QuickAssignment({ 
  shifts, 
  rotations, 
  onUpdateRotation 
}: QuickAssignmentProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
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
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: assignedShift.color }}
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {assignedShift.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({formatTime(assignedShift.start_time)} - {formatTime(assignedShift.end_time)})
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={dayRotation?.shift_id || ''}
                    onChange={(e) => onUpdateRotation(day.id, e.target.value || null)}
                    className="block w-48 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  >
                    <option value="">No shift</option>
                    {shifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({formatTime(shift.start_time)} - {formatTime(shift.end_time)})
                      </option>
                    ))}
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