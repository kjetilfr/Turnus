'use client'

import { DAYS_OF_WEEK } from '@/lib/constants'
import type { Plan, Shift, Rotation } from '@/types/scheduler'

interface RotationGridProps {
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
  onRotationUpdate: (dayOfWeek: number, shiftId: string | null) => Promise<void>
}

export default function RotationGrid({ 
  plan, 
  shifts, 
  rotations, 
  onRotationUpdate 
}: RotationGridProps) {
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

  const handleDayClick = async (dayOfWeek: number) => {
    const dayRotation = getRotationForDay(dayOfWeek)
    const currentShiftId = dayRotation?.shift_id || ''
    const shiftIndex = shifts.findIndex(s => s.id === currentShiftId)
    const nextShiftIndex = (shiftIndex + 1) % (shifts.length + 1)
    const nextShiftId = nextShiftIndex === 0 ? null : shifts[nextShiftIndex - 1].id
    await onRotationUpdate(dayOfWeek, nextShiftId)
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schedule Grid</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Click on any day to assign a shift
        </p>
      </div>
      <div className="p-6 overflow-x-auto">
        <div className="min-w-full">
          {/* Week headers and grid */}
          {Array.from({ length: plan.duration_weeks }, (_, weekIndex) => (
            <div key={weekIndex} className="mb-8 last:mb-0">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Week {weekIndex + 1}
              </h4>
              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const dayRotation = getRotationForDay(day.id)
                  const assignedShift = dayRotation?.shift
                  const isSunday = day.id === 0
                  
                  return (
                    <div
                      key={`week-${weekIndex}-day-${day.id}`}
                      className={`text-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-200 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600`}
                      onClick={() => handleDayClick(day.id)}
                    >
                      <div className={`text-xs font-medium mb-2 ${
                        isSunday 
                          ? 'text-red-700 dark:text-red-300' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {day.short}
                      </div>
                      {assignedShift ? (
                        <div className="space-y-1">
                          <div
                            className="w-4 h-4 rounded-full mx-auto"
                            style={{ backgroundColor: assignedShift.color }}
                          />
                          <div className={`text-xs font-medium ${
                            isSunday 
                              ? 'text-red-800 dark:text-red-200' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {assignedShift.name}
                          </div>
                          <div className={`text-xs ${
                            isSunday 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {formatTime(assignedShift.start_time)}
                          </div>
                          <div className={`text-xs ${
                            isSunday 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {formatTime(assignedShift.end_time)}
                          </div>
                        </div>
                      ) : (
                        <div className={`text-xs ${
                          isSunday 
                            ? 'text-red-500 dark:text-red-400' 
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          No shift
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}