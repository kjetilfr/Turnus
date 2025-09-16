// src/components/plan/EnhancedRotationGrid.tsx
'use client'

import type { Plan, Shift, Rotation } from '@/types/scheduler'
import { DAYS_OF_WEEK } from '@/lib/constants'

interface EnhancedRotationGridProps {
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
  onUpdateRotation: (weekIndex: number, dayOfWeek: number, shiftId: string | null) => void
}

export default function EnhancedRotationGrid({ 
  plan, 
  shifts, 
  rotations, 
  onUpdateRotation 
}: EnhancedRotationGridProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Find rotation for specific week and day
  const getRotationForWeekDay = (weekIndex: number, dayOfWeek: number) => {
    return rotations.find(r => r.week_index === weekIndex && r.day_of_week === dayOfWeek)
  }

  const handleDayClick = (weekIndex: number, dayId: number) => {
    const rotation = getRotationForWeekDay(weekIndex, dayId)
    const currentShiftId = rotation?.shift_id || ''
    const shiftIndex = shifts.findIndex(s => s.id === currentShiftId)
    const nextShiftIndex = (shiftIndex + 1) % (shifts.length + 1)
    const nextShiftId = nextShiftIndex === 0 ? null : shifts[nextShiftIndex - 1].id
    onUpdateRotation(weekIndex, dayId, nextShiftId)
  }

  const handleDropdownChange = (weekIndex: number, dayId: number, shiftId: string | null) => {
    onUpdateRotation(weekIndex, dayId, shiftId)
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Individual Day Assignment</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Click on any day to cycle through shifts, or use the dropdown for precise control
        </p>
      </div>
      <div className="p-6 overflow-x-auto">
        <div className="min-w-full space-y-8">
          {/* Day headers */}
          <div className="grid grid-cols-8 gap-2 mb-4">
            <div className="text-center py-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              Week
            </div>
            {DAYS_OF_WEEK.map((day) => (
              <div 
                key={day.id} 
                className={`text-center py-2 text-sm font-medium ${
                  day.id === 0 
                    ? 'text-red-700 dark:text-red-300' 
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {day.name}
              </div>
            ))}
          </div>

          {/* Week rows */}
          {Array.from({ length: plan.duration_weeks }, (_, weekIndex) => (
            <div key={weekIndex} className="space-y-4">
              {/* Visual grid row */}
              <div className="grid grid-cols-8 gap-2">
                {/* Week label */}
                <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {weekIndex + 1}
                  </span>
                </div>

                {/* Day cells */}
                {DAYS_OF_WEEK.map((day) => {
                  const rotation = getRotationForWeekDay(weekIndex, day.id)
                  const assignedShift = rotation?.shift
                  const isSunday = day.id === 0
                  
                  return (
                    <div
                      key={`week-${weekIndex}-day-${day.id}`}
                      className={`text-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 min-h-[120px] flex flex-col justify-center ${
                        assignedShift 
                          ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                      } hover:shadow-md`}
                      onClick={() => handleDayClick(weekIndex, day.id)}
                    >
                      <div className={`text-xs font-medium mb-2 ${
                        isSunday 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {day.short}
                      </div>
                      {assignedShift ? (
                        <div className="space-y-2">
                          <div
                            className="w-6 h-6 rounded-full mx-auto border-2 border-white dark:border-gray-800"
                            style={{ backgroundColor: assignedShift.color }}
                          />
                          <div className="text-xs font-medium text-gray-900 dark:text-white">
                            {assignedShift.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {formatTime(assignedShift.start_time)}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {formatTime(assignedShift.end_time)}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="w-6 h-6 rounded-full mx-auto border-2 border-dashed border-gray-300 dark:border-gray-600" />
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            No shift
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            Click to assign
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Dropdown controls row */}
              <div className="grid grid-cols-8 gap-2">
                {/* Empty cell for week label alignment */}
                <div></div>

                {/* Dropdown for each day */}
                {DAYS_OF_WEEK.map((day) => {
                  const rotation = getRotationForWeekDay(weekIndex, day.id)
                  
                  return (
                    <div key={`dropdown-week-${weekIndex}-day-${day.id}`} className="relative">
                      <select
                        value={rotation?.shift_id || ''}
                        onChange={(e) => handleDropdownChange(weekIndex, day.id, e.target.value || null)}
                        className="block w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                      >
                        <option value="">No shift</option>
                        {shifts.map((shift) => (
                          <option key={shift.id} value={shift.id}>
                            {shift.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">How to use:</h4>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>• <strong>Click on any day cell</strong> to cycle through available shifts</p>
            <p>• <strong>Use dropdowns</strong> below each week for precise shift selection</p>
            <p>• <strong>Each day can have a different shift</strong> - Monday Week 1 can be different from Monday Week 2</p>
            <p>• <strong>Empty cells</strong> represent days off</p>
          </div>
        </div>
      </div>
    </div>
  )
}