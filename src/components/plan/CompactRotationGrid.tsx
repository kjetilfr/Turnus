// src/components/plan/CompactRotationGrid.tsx - Enhanced version
'use client'

import { useState } from 'react'
import { DAYS_OF_WEEK } from '@/lib/constants'
import type { Plan, Shift, Rotation } from '@/types/scheduler'

interface CompactRotationGridProps {
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
  onRotationUpdate: (weekIndex: number, dayOfWeek: number, shiftId: string | null) => Promise<void>
}

export default function CompactRotationGrid({ 
  plan, 
  shifts, 
  rotations, 
  onRotationUpdate 
}: CompactRotationGridProps) {
  const [draggedShift, setDraggedShift] = useState<Shift | null>(null)
  const [draggedFrom, setDraggedFrom] = useState<{weekIndex: number, dayOfWeek: number} | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{weekIndex: number, dayOfWeek: number} | null>(null)
  const [selectedCell, setSelectedCell] = useState<{weekIndex: number, dayOfWeek: number} | null>(null)

  // Helper function to check if a shift is an F shift (F1-F5)
  const isFShift = (shift: Shift): boolean => {
    return /^f[1-5]$/i.test(shift.name.trim())
  }

  const getRotationForWeekDay = (weekIndex: number, dayOfWeek: number) => {
    return rotations.find(r => r.week_index === weekIndex && r.day_of_week === dayOfWeek)
  }

  const handleDragStart = (e: React.DragEvent, shift: Shift, fromWeek?: number, fromDay?: number) => {
    setDraggedShift(shift)
    if (fromWeek !== undefined && fromDay !== undefined) {
      setDraggedFrom({ weekIndex: fromWeek, dayOfWeek: fromDay })
    } else {
      setDraggedFrom(null)
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '')
  }

  const handleDragOver = (e: React.DragEvent, weekIndex: number, dayOfWeek: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCell({ weekIndex, dayOfWeek })
  }

  const handleDragLeave = (e: React.DragEvent) => {
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
      if (!draggedFrom) {
        await onRotationUpdate(weekIndex, dayOfWeek, draggedShift.id)
      } else {
        const currentRotation = getRotationForWeekDay(weekIndex, dayOfWeek)
        
        if (draggedFrom.weekIndex === weekIndex && draggedFrom.dayOfWeek === dayOfWeek) {
          return
        }
        
        if (currentRotation?.shift) {
          await onRotationUpdate(draggedFrom.weekIndex, draggedFrom.dayOfWeek, currentRotation.shift.id)
        } else {
          await onRotationUpdate(draggedFrom.weekIndex, draggedFrom.dayOfWeek, null)
        }
        
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
        await onRotationUpdate(weekIndex, dayOfWeek, null)
      } catch (error) {
        console.error('Error removing shift:', error)
        alert('Failed to remove shift. Please try again.')
      }
    }
  }

  const handleCellClick = (weekIndex: number, dayOfWeek: number) => {
    setSelectedCell({ weekIndex, dayOfWeek })
  }

  // Quick assignment via dropdown
  const handleQuickAssign = async (weekIndex: number, dayOfWeek: number, shiftId: string) => {
    try {
      await onRotationUpdate(weekIndex, dayOfWeek, shiftId || null)
      setSelectedCell(null)
    } catch (error) {
      console.error('Error in quick assignment:', error)
      alert('Failed to assign shift. Please try again.')
    }
  }

  return (
    <div className="space-y-2">
      {/* Ultra-Compact Shift Palette */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        <div className="px-2 py-1 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="text-xs font-medium text-gray-900 dark:text-white">Available Shifts</div>
        </div>
        <div className="p-2">
          <div className="flex flex-wrap gap-1">
            {shifts.map((shift) => {
              const isShiftFShift = isFShift(shift)
              const isDragging = draggedShift?.id === shift.id && !draggedFrom
              
              return (
                <div
                  key={shift.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, shift)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs cursor-move hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 ${
                    isDragging ? 'opacity-50' : ''
                  }`}
                  style={{ backgroundColor: `${shift.color}20`, border: `1px solid ${shift.color}40` }}
                  title={isShiftFShift ? 'F Shift' : `${shift.start_time} - ${shift.end_time}`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: shift.color }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {shift.name}
                  </span>
                  {!isShiftFShift && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {shift.start_time.slice(0, 5)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Ultra-Compact Schedule Grid - Excel-like with enhanced features */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-1 py-1.5 text-center font-semibold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600 w-12 sticky left-0 bg-gray-100 dark:bg-gray-700">
                  Week
                </th>
                {DAYS_OF_WEEK.map((day) => (
                  <th 
                    key={day.id} 
                    className={`px-1 py-1.5 text-center font-semibold border-r border-gray-200 dark:border-gray-600 last:border-r-0 min-w-[60px] ${
                      day.id === 0 ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className="leading-tight">
                      <div className="font-bold">{day.short}</div>
                      <div className="text-xs font-normal opacity-75">{day.name.slice(0, 3)}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: plan.duration_weeks }, (_, weekIndex) => (
                <tr key={weekIndex} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 ${weekIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750/50'}`}>
                  <td className="px-1 py-0 font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border-r border-gray-300 dark:border-gray-600 text-center sticky left-0">
                    <div className="py-2">
                      <div className="text-sm">{weekIndex + 1}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">W{weekIndex + 1}</div>
                    </div>
                  </td>
                  {DAYS_OF_WEEK.map((day) => {
                    const dayRotation = getRotationForWeekDay(weekIndex, day.id)
                    const assignedShift = dayRotation?.shift
                    const isSunday = day.id === 0
                    const isAssignedFShift = assignedShift && isFShift(assignedShift)
                    const isDraggedOver = dragOverCell?.weekIndex === weekIndex && dragOverCell?.dayOfWeek === day.id
                    const isBeingDragged = draggedFrom?.weekIndex === weekIndex && draggedFrom?.dayOfWeek === day.id && draggedShift?.id === assignedShift?.id
                    const isSelected = selectedCell?.weekIndex === weekIndex && selectedCell?.dayOfWeek === day.id
                    
                    return (
                      <td
                        key={`week-${weekIndex}-day-${day.id}`}
                        className={`p-0 border-r border-gray-100 dark:border-gray-700 last:border-r-0 relative cursor-pointer ${
                          isSunday ? 'bg-red-50/30 dark:bg-red-900/10' : ''
                        } ${
                          isDraggedOver ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                        } ${
                          isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                        }`}
                        onDragOver={(e) => handleDragOver(e, weekIndex, day.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, weekIndex, day.id)}
                        onDoubleClick={() => handleDoubleClick(weekIndex, day.id)}
                        onClick={() => handleCellClick(weekIndex, day.id)}
                      >
                        {assignedShift ? (
                          <div 
                            className={`w-full min-h-[32px] flex items-center justify-center text-white text-xs font-semibold cursor-move relative ${isBeingDragged ? 'opacity-50' : ''}`}
                            style={{ backgroundColor: assignedShift.color }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, assignedShift, weekIndex, day.id)}
                            onDragEnd={handleDragEnd}
                            title={`${assignedShift.name}${!isAssignedFShift ? ` (${assignedShift.start_time.slice(0, 5)}-${assignedShift.end_time.slice(0, 5)})` : ' (F-shift)'} - Double-click to remove`}
                          >
                            <div className="text-center leading-tight">
                              <div className="font-bold">{assignedShift.name}</div>
                              {!isAssignedFShift && (
                                <div className="text-xs opacity-90">
                                  {assignedShift.start_time.slice(0, 5)}
                                </div>
                              )}
                            </div>
                            {/* Quick remove button */}
                            <button
                              className="absolute top-0 right-0 w-3 h-3 text-white hover:text-red-200 opacity-0 hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDoubleClick(weekIndex, day.id)
                              }}
                              title="Remove shift"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div 
                            className={`w-full min-h-[32px] flex items-center justify-center text-xs border-2 border-dashed ${
                              isDraggedOver 
                                ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400' 
                                : isSunday 
                                  ? 'border-red-200 dark:border-red-800 text-red-300 dark:text-red-600' 
                                  : 'border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600'
                            } hover:border-gray-400 dark:hover:border-gray-500 transition-colors`}
                          >
                            {isDraggedOver ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              '+'
                            )}
                          </div>
                        )}

                        {/* Quick assignment dropdown for selected cell */}
                        {isSelected && (
                          <div className="absolute top-full left-0 z-10 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg">
                            <div className="py-1">
                              <div className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700">
                                Quick assign:
                              </div>
                              {shifts.map((shift) => (
                                <button
                                  key={shift.id}
                                  onClick={() => handleQuickAssign(weekIndex, day.id, shift.id)}
                                  className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-1"
                                >
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: shift.color }}
                                  />
                                  <span>{shift.name}</span>
                                </button>
                              ))}
                              <button
                                onClick={() => handleQuickAssign(weekIndex, day.id, '')}
                                className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ultra-Compact Instructions */}
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-1.5">
        <div className="flex flex-wrap gap-2 text-xs">
          <span><strong>Drag:</strong> from palette or between cells</span>
          <span><strong>Click:</strong> quick assign menu</span>
          <span><strong>Double-click:</strong> remove</span>
          <span><strong>F-shifts:</strong> ignore times</span>
        </div>
      </div>
    </div>
  )
}