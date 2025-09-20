// src/components/plan/RotationGrid.tsx - Updated with transparent color support
'use client'

import { useState } from 'react'
import { useCompactMode } from '@/lib/compact-mode-context'
import { DAYS_OF_WEEK } from '@/lib/constants'
import CompactRotationGrid from './CompactRotationGrid'
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
  const { compactMode } = useCompactMode()
  const [draggedShift, setDraggedShift] = useState<Shift | null>(null)
  const [draggedFrom, setDraggedFrom] = useState<{weekIndex: number, dayOfWeek: number} | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{weekIndex: number, dayOfWeek: number} | null>(null)

  // If compact mode is enabled, use the enhanced compact grid component
  if (compactMode) {
    return (
      <CompactRotationGrid
        plan={plan}
        shifts={shifts}
        rotations={rotations}
        onRotationUpdate={onRotationUpdate}
      />
    )
  }

  // Helper function to check if a shift is an F shift (F1-F5)
  const isFShift = (shift: Shift): boolean => {
    return /^f[1-5]$/i.test(shift.name.trim())
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
  }

  const getRotationForWeekDay = (weekIndex: number, dayOfWeek: number) => {
    return rotations.find(r => r.week_index === weekIndex && r.day_of_week === dayOfWeek)
  }

  const handleDragStart = (e: React.DragEvent, shift: Shift, fromWeek?: number, fromDay?: number) => {
    setDraggedShift(shift)
    if (fromWeek !== undefined && fromDay !== undefined) {
      setDraggedFrom({ weekIndex: fromWeek, dayOfWeek: fromDay })
    } else {
      setDraggedFrom(null) // Dragging from palette
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '') // Required for Firefox
  }

  const handleDragOver = (e: React.DragEvent, weekIndex: number, dayOfWeek: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCell({ weekIndex, dayOfWeek })
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drag over if we're actually leaving the cell
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const isStillInside = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    )
    
    if (!isStillInside) {
      setDragOverCell(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, weekIndex: number, dayOfWeek: number) => {
    e.preventDefault()
    setDragOverCell(null)
    
    if (!draggedShift) {
      setDraggedFrom(null)
      return
    }

    try {
      // If dragging from the shift palette (not from another cell)
      if (!draggedFrom) {
        console.log(`Assigning shift ${draggedShift.name} to Week ${weekIndex + 1}, Day ${dayOfWeek}`)
        await onRotationUpdate(weekIndex, dayOfWeek, draggedShift.id)
      } else {
        // If dragging from another cell, handle move/swap
        const currentRotation = getRotationForWeekDay(weekIndex, dayOfWeek)
        
        // If dropping on same cell, do nothing
        if (draggedFrom.weekIndex === weekIndex && draggedFrom.dayOfWeek === dayOfWeek) {
          console.log('Dropped on same cell, no action needed')
          return
        }
        
        console.log(`Moving shift ${draggedShift.name} from Week ${draggedFrom.weekIndex + 1}, Day ${draggedFrom.dayOfWeek} to Week ${weekIndex + 1}, Day ${dayOfWeek}`)
        
        // If there's already a shift at destination, swap them
        if (currentRotation?.shift) {
          console.log(`Swapping with existing shift ${currentRotation.shift.name}`)
          // First move the destination shift to source location
          await onRotationUpdate(draggedFrom.weekIndex, draggedFrom.dayOfWeek, currentRotation.shift.id)
        } else {
          console.log('Moving to empty cell, clearing source')
          // Just clear the source location
          await onRotationUpdate(draggedFrom.weekIndex, draggedFrom.dayOfWeek, null)
        }
        
        // Then move the dragged shift to destination
        await onRotationUpdate(weekIndex, dayOfWeek, draggedShift.id)
      }
    } catch (error) {
      console.error('Error handling drop:', error)
      alert('Failed to update rotation. Please try again.')
    } finally {
      setDraggedShift(null)
      setDraggedFrom(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedShift(null)
    setDraggedFrom(null)
    setDragOverCell(null)
  }

  const handleDoubleClick = async (weekIndex: number, dayOfWeek: number) => {
    const rotation = getRotationForWeekDay(weekIndex, dayOfWeek)
    if (rotation?.shift_id) {
      try {
        console.log(`Removing shift from Week ${weekIndex + 1}, Day ${dayOfWeek}`)
        await onRotationUpdate(weekIndex, dayOfWeek, null)
      } catch (error) {
        console.error('Error removing shift:', error)
        alert('Failed to remove shift. Please try again.')
      }
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent, weekIndex: number, dayOfWeek: number) => {
    // Allow keyboard removal with Delete or Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const rotation = getRotationForWeekDay(weekIndex, dayOfWeek)
      if (rotation?.shift_id) {
        try {
          console.log(`Removing shift from Week ${weekIndex + 1}, Day ${dayOfWeek} via keyboard`)
          await onRotationUpdate(weekIndex, dayOfWeek, null)
        } catch (error) {
          console.error('Error removing shift:', error)
          alert('Failed to remove shift. Please try again.')
        }
      }
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
            {shifts.map((shift) => {
              const isShiftFShift = isFShift(shift)
              const isDragging = draggedShift?.id === shift.id && !draggedFrom
              const isTransparent = shift.color === 'none'
              
              return (
                <div
                  key={shift.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, shift)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-move hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 ${
                    isDragging ? 'opacity-50' : ''
                  }`}
                  title={isShiftFShift ? 'F Shift - placement only matters' : `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`}
                >
                  <div
                    className={`w-3 h-3 rounded-full ${isTransparent ? 'border border-gray-400 bg-gray-50 dark:bg-gray-600' : ''}`}
                    style={{ backgroundColor: shift.color === 'none' ? 'transparent' : shift.color }}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {shift.name}
                  </span>
                  {!isShiftFShift && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </span>
                  )}
                  {isTransparent && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                      (no color)
                    </span>
                  )}
                </div>
              )
            })}
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
            Drag shifts from above or between days. Double-click or press Delete to remove a shift.
          </p>
        </div>
        <div className="p-6 overflow-x-auto">
          <div className="min-w-full space-y-8">
            {Array.from({ length: plan.duration_weeks }, (_, weekIndex) => (
              <div key={weekIndex} className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Week {weekIndex + 1}
                </h4>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayRotation = getRotationForWeekDay(weekIndex, day.id)
                    const assignedShift = dayRotation?.shift
                    const isSunday = day.id === 0
                    const isAssignedFShift = assignedShift && isFShift(assignedShift)
                    const isTransparent = assignedShift && assignedShift.color === 'none'
                    const isDraggedOver = dragOverCell?.weekIndex === weekIndex && dragOverCell?.dayOfWeek === day.id
                    const isBeingDragged = draggedFrom?.weekIndex === weekIndex && draggedFrom?.dayOfWeek === day.id && draggedShift?.id === assignedShift?.id
                    
                    return (
                      <div
                        key={`week-${weekIndex}-day-${day.id}`}
                        className={`text-center p-3 rounded-lg border-2 min-h-[120px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          assignedShift 
                            ? `bg-gray-50 dark:bg-gray-700 border-solid ${
                                isBeingDragged 
                                  ? 'opacity-50 border-blue-400 dark:border-blue-500' 
                                  : 'border-gray-300 dark:border-gray-600'
                              }` 
                            : `bg-gray-25 dark:bg-gray-750 border-dashed border-gray-300 dark:border-gray-600 ${
                                isDraggedOver 
                                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                  : 'hover:border-gray-400 dark:hover:border-gray-500'
                              }`
                        }`}
                        onDragOver={(e) => handleDragOver(e, weekIndex, day.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, weekIndex, day.id)}
                        onDoubleClick={() => handleDoubleClick(weekIndex, day.id)}
                        onKeyDown={(e) => handleKeyDown(e, weekIndex, day.id)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${day.name} Week ${weekIndex + 1}${assignedShift ? ` - ${assignedShift.name}` : ' - Empty'}`}
                        title={assignedShift ? "Double-click or press Delete to remove shift" : "Drag a shift here"}
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
                            className={`space-y-1 cursor-move ${isBeingDragged ? 'opacity-50' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, assignedShift, weekIndex, day.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <div
                              className={`w-4 h-4 rounded-full mx-auto ${isTransparent ? 'border border-gray-400 bg-gray-50 dark:bg-gray-600' : ''}`}
                              style={{ backgroundColor: assignedShift.color === 'none' ? 'transparent' : assignedShift.color }}
                            />
                            <div className={`text-xs font-medium ${
                              isSunday 
                                ? 'text-red-800 dark:text-red-200' 
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {assignedShift.name}
                              {isTransparent && (
                                <span className="block text-xs text-gray-500 dark:text-gray-400 italic">
                                  (no color)
                                </span>
                              )}
                            </div>
                            {!isAssignedFShift ? (
                              <>
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
                              </>
                            ) : (
                              <div className={`text-xs ${
                                isSunday 
                                  ? 'text-red-500 dark:text-red-400' 
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={`text-xs mt-8 ${
                            isSunday 
                              ? 'text-red-400 dark:text-red-500' 
                              : 'text-gray-400 dark:text-gray-500'
                          } ${isDraggedOver ? 'text-blue-500 dark:text-blue-400' : ''}`}>
                            {isDraggedOver ? 'Drop here' : 'Drop shift here'}
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

      {/* Instructions/Legend */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          How to use the Schedule Grid:
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <li>• <strong>Drag from palette:</strong> Drag any shift from &quot;Available Shifts&quot; to assign it to a day</li>
          <li>• <strong>Move shifts:</strong> Drag shifts between days to move or swap them</li>
          <li>• <strong>Remove shifts:</strong> Double-click on an assigned shift or press Delete/Backspace</li>
          <li>• <strong>F Shifts:</strong> F1-F5 shifts don&apos;t use specific times - only placement matters</li>
          <li>• <strong>No color shifts:</strong> Appear with no background color</li>
          <li>• <strong>Sundays:</strong> Shown in red text - typically F3 shifts should go here</li>
        </ul>
      </div>
    </div>
  )
}