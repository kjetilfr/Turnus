// src/components/ai/RotationVisualComparison.tsx
'use client'

import { Rotation, DAY_NAMES_SHORT_NORWEGIAN } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { useMemo } from 'react'

interface RotationVisualComparisonProps {
  currentRotation: Rotation[]
  proposedRotation: Rotation[]
  shifts: Shift[]
  durationWeeks: number
}

export default function RotationVisualComparison({
  currentRotation,
  proposedRotation,
  shifts,
  durationWeeks
}: RotationVisualComparisonProps) {
  
  // Organize current rotation into grid
  const currentGrid = useMemo(() => {
    const grid: { [week: number]: { [day: number]: Rotation } } = {}
    currentRotation.forEach(rotation => {
      if (!grid[rotation.week_index]) {
        grid[rotation.week_index] = {}
      }
      grid[rotation.week_index][rotation.day_of_week] = rotation
    })
    return grid
  }, [currentRotation])

  // Organize proposed rotation into grid
  const proposedGrid = useMemo(() => {
    const grid: { [week: number]: { [day: number]: Rotation } } = {}
    proposedRotation.forEach(rotation => {
      if (!grid[rotation.week_index]) {
        grid[rotation.week_index] = {}
      }
      grid[rotation.week_index][rotation.day_of_week] = rotation
    })
    return grid
  }, [proposedRotation])

  const getShiftById = (shiftId: string | null) => {
    if (!shiftId) return null
    return shifts.find(s => s.id === shiftId)
  }

  const hasChanged = (weekIndex: number, dayIndex: number) => {
    const current = currentGrid[weekIndex]?.[dayIndex]
    const proposed = proposedGrid[weekIndex]?.[dayIndex]
    return current?.shift_id !== proposed?.shift_id
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Visuell samanlikning</h3>
          <p className="text-sm text-gray-600">Før og etter forbetringar</p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded"></div>
          <span className="text-gray-700">Uendra</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-400 rounded"></div>
          <span className="text-gray-700">Endra</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Current Rotation */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
              NÅ
            </span>
            Gjeldande turnus
          </h4>
          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left font-semibold">V</th>
                  {DAY_NAMES_SHORT_NORWEGIAN.map((day, i) => (
                    <th key={i} className="border border-gray-300 px-2 py-1 text-center font-semibold">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: durationWeeks }, (_, weekIndex) => (
                  <tr key={weekIndex}>
                    <td className="border border-gray-300 px-2 py-1 font-medium bg-gray-50">
                      {weekIndex + 1}
                    </td>
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const rotation = currentGrid[weekIndex]?.[dayIndex]
                      const shift = rotation?.shift_id ? getShiftById(rotation.shift_id) : null
                      const changed = hasChanged(weekIndex, dayIndex)
                      
                      return (
                        <td 
                          key={dayIndex}
                          className={`border border-gray-300 px-2 py-2 text-center ${
                            changed ? 'bg-yellow-100 border-yellow-400' : 'bg-white'
                          }`}
                        >
                          {shift ? (
                            <span className={`font-semibold ${
                              shift.is_default ? 'text-gray-800' : 'text-indigo-800'
                            }`}>
                              {shift.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
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

        {/* Proposed Rotation */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
              NY
            </span>
            Foreslått turnus
          </h4>
          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left font-semibold">V</th>
                  {DAY_NAMES_SHORT_NORWEGIAN.map((day, i) => (
                    <th key={i} className="border border-gray-300 px-2 py-1 text-center font-semibold">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: durationWeeks }, (_, weekIndex) => (
                  <tr key={weekIndex}>
                    <td className="border border-gray-300 px-2 py-1 font-medium bg-gray-50">
                      {weekIndex + 1}
                    </td>
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const rotation = proposedGrid[weekIndex]?.[dayIndex]
                      const shift = rotation?.shift_id ? getShiftById(rotation.shift_id) : null
                      const changed = hasChanged(weekIndex, dayIndex)
                      
                      return (
                        <td 
                          key={dayIndex}
                          className={`border border-gray-300 px-2 py-2 text-center ${
                            changed ? 'bg-yellow-100 border-yellow-400' : 'bg-white'
                          }`}
                        >
                          {shift ? (
                            <span className={`font-semibold ${
                              shift.is_default ? 'text-gray-800' : 'text-indigo-800'
                            }`}>
                              {shift.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
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
      </div>
    </div>
  )
}