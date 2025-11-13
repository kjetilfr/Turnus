// src/components/rotation/RotationComparisonGrid.tsx
'use client'

import { Shift } from '@/types/shift'
import { DAY_NAMES_SHORT_NORWEGIAN } from '@/types/rotation'
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { useMemo } from 'react'

interface ProposedChange {
  week_index: number
  day_of_week: number
  current_shift_id: string | null
  proposed_shift_id: string | null
  reason: string
}

interface RotationData {
  week_index: number
  day_of_week: number
  shift_id: string | null
}

interface RotationComparisonGridProps {
  currentRotation: RotationData[]
  proposedChanges: ProposedChange[]
  shifts: Shift[]
  durationWeeks: number
  summary: string
  improvements: string[]
  onApply: () => void
  onCancel: () => void
  isApplying?: boolean
}

export default function RotationComparisonGrid({
  currentRotation,
  proposedChanges,
  shifts,
  durationWeeks,
  summary,
  improvements,
  onApply,
  onCancel,
  isApplying = false
}: RotationComparisonGridProps) {

  // Apply changes to create new rotation
  const newRotation = useMemo(() => {
    // Start with a copy of current rotation
    const rotation = [...currentRotation]
    
    // Apply each change
    proposedChanges.forEach(change => {
      const existingIndex = rotation.findIndex(
        r => r.week_index === change.week_index && r.day_of_week === change.day_of_week
      )

      if (change.proposed_shift_id === null) {
        // Remove the shift
        if (existingIndex !== -1) {
          rotation.splice(existingIndex, 1)
        }
      } else if (existingIndex !== -1) {
        // Update existing
        rotation[existingIndex] = {
          ...rotation[existingIndex],
          shift_id: change.proposed_shift_id
        }
      } else {
        // Add new
        rotation.push({
          week_index: change.week_index,
          day_of_week: change.day_of_week,
          shift_id: change.proposed_shift_id
        })
      }
    })

    return rotation
  }, [currentRotation, proposedChanges])

  // Organize into grids
  const createGrid = (rotationData: RotationData[]) => {
    const grid: Record<number, Record<number, string | null>> = {}
    
    for (let week = 0; week < durationWeeks; week++) {
      grid[week] = {}
      for (let day = 0; day < 7; day++) {
        grid[week][day] = null
      }
    }
    
    rotationData.forEach(r => {
      if (!grid[r.week_index]) grid[r.week_index] = {}
      grid[r.week_index][r.day_of_week] = r.shift_id
    })
    
    return grid
  }

  const currentGrid = createGrid(currentRotation)
  const newGrid = createGrid(newRotation)

  // Check if a cell has changed
  const hasChanged = (week: number, day: number) => {
    return currentGrid[week][day] !== newGrid[week][day]
  }

  // Get shift name
  const getShiftName = (shiftId: string | null): string => {
    if (!shiftId) return '-'
    const shift = shifts.find(s => s.id === shiftId)
    return shift?.name || 'Ukjend'
  }

  // Calculate hours
  const calculateHours = (grid: Record<number, Record<number, string | null>>) => {
    const weeklyHours: Record<number, number> = {}
    
    for (let week = 0; week < durationWeeks; week++) {
      let total = 0
      for (let day = 0; day < 7; day++) {
        const shiftId = grid[week][day]
        if (shiftId) {
          const shift = shifts.find(s => s.id === shiftId)
          if (shift && shift.start_time && shift.end_time) {
            const start = shift.start_time.split(':').map(Number)
            const end = shift.end_time.split(':').map(Number)
            let hours = end[0] - start[0] + (end[1] - start[1]) / 60
            if (hours < 0) hours += 24
            total += hours
          }
        }
      }
      weeklyHours[week] = total
    }
    
    return weeklyHours
  }

  const currentHours = calculateHours(currentGrid)
  const newHours = calculateHours(newGrid)
  
  const currentTotal = Object.values(currentHours).reduce((sum, h) => sum + h, 0)
  const newTotal = Object.values(newHours).reduce((sum, h) => sum + h, 0)
  const totalDiff = newTotal - currentTotal

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Samanlikning: Gammal vs Ny Turnus
              </h2>
              <p className="text-gray-600">{summary}</p>
            </div>
            <button
              onClick={onCancel}
              disabled={isApplying}
              className="text-gray-400 hover:text-gray-600 ml-4"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Endringar</div>
              <div className="text-2xl font-bold text-blue-900">{proposedChanges.length}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 font-medium">Gamle timar</div>
              <div className="text-2xl font-bold text-gray-900">{currentTotal.toFixed(1)}t</div>
            </div>
            <div className={`p-3 rounded-lg ${
              Math.abs(totalDiff) <= 2 ? 'bg-green-50' : 'bg-yellow-50'
            }`}>
              <div className={`text-sm font-medium ${
                Math.abs(totalDiff) <= 2 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                Nye timar
              </div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${
                Math.abs(totalDiff) <= 2 ? 'text-green-900' : 'text-yellow-900'
              }`}>
                {newTotal.toFixed(1)}t
                <span className="text-sm">
                  ({totalDiff > 0 ? '+' : ''}{totalDiff.toFixed(1)}t)
                </span>
              </div>
            </div>
          </div>

          {/* Improvements */}
          {improvements && improvements.length > 0 && (
            <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
              <div className="font-semibold text-indigo-900 mb-1">Forbetringar:</div>
              <ul className="list-disc list-inside space-y-1 text-indigo-800 text-sm">
                {improvements.map((improvement, index) => (
                  <li key={index}>{improvement}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Comparison Grid */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-100 border border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Veke
                  </th>
                  {DAY_NAMES_SHORT_NORWEGIAN.map((day, index) => (
                    <th 
                      key={index}
                      className="border border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-700"
                    >
                      {day}
                    </th>
                  ))}
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-700">
                    Timar
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: durationWeeks }, (_, weekIndex) => (
                  <tr key={weekIndex}>
                    <td className="sticky left-0 z-10 bg-gray-50 border border-gray-300 px-3 py-2 text-xs font-medium text-gray-900">
                      Veke {weekIndex + 1}
                    </td>
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const changed = hasChanged(weekIndex, dayIndex)
                      const currentShift = getShiftName(currentGrid[weekIndex][dayIndex])
                      const newShift = getShiftName(newGrid[weekIndex][dayIndex])

                      return (
                        <td 
                          key={dayIndex}
                          className={`border border-gray-300 px-2 py-2 text-center text-xs ${
                            changed 
                              ? 'bg-yellow-50 border-yellow-300' 
                              : 'bg-white'
                          }`}
                        >
                          {changed ? (
                            <div className="space-y-1">
                              <div className="line-through text-red-600 font-medium">
                                {currentShift}
                              </div>
                              <ArrowRight className="w-3 h-3 mx-auto text-gray-400" />
                              <div className="text-green-600 font-bold">
                                {newShift}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-700 font-medium">
                              {currentShift}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className={`border border-gray-300 px-2 py-2 text-center text-xs font-semibold ${
                      currentHours[weekIndex] !== newHours[weekIndex]
                        ? 'bg-yellow-50'
                        : 'bg-gray-50'
                    }`}>
                      {currentHours[weekIndex] !== newHours[weekIndex] ? (
                        <div className="space-y-1">
                          <div className="line-through text-red-600">
                            {currentHours[weekIndex].toFixed(1)}t
                          </div>
                          <div className="text-green-600 font-bold">
                            {newHours[weekIndex].toFixed(1)}t
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-700">
                          {currentHours[weekIndex].toFixed(1)}t
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                
                {/* Total Row */}
                <tr className="bg-gray-100 font-bold">
                  <td className="sticky left-0 z-10 bg-gray-200 border border-gray-300 px-3 py-2 text-xs">
                    Total
                  </td>
                  {Array.from({ length: 7 }, (_, dayIndex) => (
                    <td 
                      key={dayIndex}
                      className="border border-gray-300 px-2 py-2 text-center text-xs"
                    >
                      -
                    </td>
                  ))}
                  <td className="border border-gray-300 px-2 py-2 text-center text-xs">
                    {currentTotal !== newTotal ? (
                      <div className="space-y-1">
                        <div className="line-through text-red-600">
                          {currentTotal.toFixed(1)}t
                        </div>
                        <div className="text-green-600 font-bold">
                          {newTotal.toFixed(1)}t
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-900">
                        {currentTotal.toFixed(1)}t
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-50 border border-yellow-300"></div>
              <span className="text-gray-600">Endra celle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border border-gray-300"></div>
              <span className="text-gray-600">Uendra</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isApplying}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={onApply}
            disabled={isApplying}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Brukar endringar...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Bruk endringar ({proposedChanges.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}