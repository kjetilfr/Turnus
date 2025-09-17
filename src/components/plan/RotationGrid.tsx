'use client'

import { useState } from 'react'
import { DAYS_OF_WEEK } from '@/lib/constants'
import type { Plan, Shift, Rotation } from '@/types/scheduler'

interface RotationGridProps {
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
  onRotationUpdate: (weekIndex: number, dayOfWeek: number, shiftId: string | null) => Promise<void>
}

export default function RotationGrid({ 
  plan, 
  shifts, 
  rotations, 
  onRotationUpdate 
}: RotationGridProps) {
  const [draggedShift, setDraggedShift] = useState<Shift | null>(null)
  const [draggedFrom, setDraggedFrom] = useState<{weekIndex: number, dayOfWeek: number} | null>(null)

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getRotationForWeekDay = (weekIndex: number, dayOfWeek: number) => {
    return rotations.find(r => r.week_index === weekIndex && r.day_of_week === dayOfWeek)
  }

  const handleDragStart = (e: React.DragEvent, shift: Shift, fromWeek?: number, fromDay?: number) => {
    setDraggedShift(shift)
    if (fromWeek !== undefined && fromDay !== undefined) {
      setDraggedFrom({ weekIndex: fromWeek, dayOfWeek: fromDay })
    }
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, weekIndex: number, dayOfWeek: number) => {
    e.preventDefault()
    
    if (draggedShift) {
      // If dragging from the shift palette, just assign the shift
      if (!draggedFrom) {
        await onRotationUpdate(weekIndex, dayOfWeek, draggedShift.id)
      } else {
        // If dragging from another day, move the shift
        const currentRotation = getRotationForWeekDay(weekIndex, dayOfWeek)
        const fromRotation = getRotationForWeekDay(draggedFrom.weekIndex, draggedFrom.dayOfWeek)
        
        // Clear the source location
        await onRotationUpdate(draggedFrom.weekIndex, draggedFrom.dayOfWeek, null)
        // Set the destination
        await onRotationUpdate(weekIndex, dayOfWeek, draggedShift.id)
        
        // If there was a shift at destination, move it to source (swap)
        if (currentRotation?.shift) {
          await onRotationUpdate(draggedFrom.weekIndex, draggedFrom.dayOfWeek, currentRotation.shift.id)
        }
      }
    }
    
    setDraggedShift(null)
    setDraggedFrom(null)
  }

  const handleDragEnd = () => {
    setDraggedShift(null)
    setDraggedFrom(null)
  }

  const handleDoubleClick = async (weekIndex: number, dayOfWeek: number) => {
    const rotation = getRotationForWeekDay(weekIndex, dayOfWeek)
    if (rotation?.shift_id) {
      await onRotationUpdate(weekIndex, dayOfWeek, null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Shift Palette */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Available Shifts</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Drag shifts to any day/week in the schedule below
          </p>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-3">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                draggable
                onDragStart={(e) => handleDragStart(e, shift)}
                onDragEnd={handleDragEnd}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-move hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: shift.color }}
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {shift.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                </span>
              </div>
            ))}
            {shifts.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No shifts available. Create shifts first.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schedule Grid</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Drag shifts from above or between days. Double-click to remove a shift.
          </p>
        </div>
        <div className="p-6 overflow-x-auto">
          <div className="min-w-full space-y-8">
            {Array.from({ length: plan.duration_weeks }, (_, weekIndex) => (
              <div key={weekIndex}>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Week {weekIndex + 1}
                </h4>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayRotation = getRotationForWeekDay(weekIndex, day.id)
                    const assignedShift = dayRotation?.shift
                    const isSunday = day.id === 0
                    
                    return (
                      <div
                        key={`week-${weekIndex}-day-${day.id}`}
                        className={`text-center p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 min-h-[120px] transition-all duration-200 ${
                          assignedShift 
                            ? 'bg-gray-50 dark:bg-gray-700 border-solid' 
                            : 'bg-gray-25 dark:bg-gray-750 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, weekIndex, day.id)}
                        onDoubleClick={() => handleDoubleClick(weekIndex, day.id)}
                        title={assignedShift ? "Double-click to remove shift" : "Drag a shift here"}
                      >
                        <div className={`text-xs font-medium mb-2 ${
                          isSunday 
                            ? 'text-red-700 dark:text-red-300' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {day.short}
                        </div>
                        {assignedShift ? (
                          <div 
                            className="space-y-1 cursor-move"
                            draggable
                            onDragStart={(e) => handleDragStart(e, assignedShift, weekIndex, day.id)}
                            onDragEnd={handleDragEnd}
                          >
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
                          <div className={`text-xs mt-8 ${
                            isSunday 
                              ? 'text-red-400 dark:text-red-500' 
                              : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            Drop shift here
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
    </div>
  )
}