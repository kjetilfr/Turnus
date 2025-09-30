// src/components/rotation/RotationGrid.tsx
'use client'

import { Rotation, DAY_NAMES_SHORT, RotationGridData } from '@/types/rotation'
import { useMemo, useState } from 'react'

interface RotationGridProps {
  rotations: Rotation[]
  durationWeeks: number
}

export default function RotationGrid({ rotations, durationWeeks }: RotationGridProps) {
  const [selectedCell, setSelectedCell] = useState<{week: number, day: number} | null>(null)

  // Organize rotations into a grid structure for easy access
  const gridData = useMemo<RotationGridData>(() => {
    const grid: RotationGridData = {}
    
    if (!rotations || rotations.length === 0) {
      return grid
    }
    
    rotations.forEach(rotation => {
      if (!grid[rotation.week_index]) {
        grid[rotation.week_index] = {}
      }
      grid[rotation.week_index][rotation.day_of_week] = rotation
    })
    
    return grid
  }, [rotations])

  const handleCellClick = (weekIndex: number, dayOfWeek: number) => {
    setSelectedCell({ week: weekIndex, day: dayOfWeek })
    // TODO: Open shift selector modal
    console.log(`Clicked cell: Week ${weekIndex + 1}, ${DAY_NAMES_SHORT[dayOfWeek]}`)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[100px]">
              Week
            </th>
            {DAY_NAMES_SHORT.map((day, index) => (
              <th 
                key={index}
                className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 min-w-[120px]"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: durationWeeks }, (_, weekIndex) => (
            <tr key={weekIndex}>
              <td className="sticky left-0 z-10 bg-gray-50 border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900">
                Week {weekIndex + 1}
              </td>
              {Array.from({ length: 7 }, (_, dayIndex) => {
                const rotation = gridData[weekIndex]?.[dayIndex]
                const isSelected = selectedCell?.week === weekIndex && selectedCell?.day === dayIndex
                
                return (
                  <td 
                    key={dayIndex}
                    onClick={() => handleCellClick(weekIndex, dayIndex)}
                    className={`
                      border border-gray-300 px-4 py-6 text-center text-sm cursor-pointer
                      transition-colors hover:bg-blue-50
                      ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-white'}
                      ${rotation?.shift_id ? 'bg-green-50' : ''}
                    `}
                  >
                    {rotation?.shift_id ? (
                      <div className="font-medium text-gray-900">
                        {/* TODO: Display shift name */}
                        Shift
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">
                        Click to add
                      </div>
                    )}
                    {rotation?.notes && (
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {rotation.notes}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {rotations.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No rotation data found. The rotation grid will be created automatically.</p>
          <p className="text-sm mt-2">Try refreshing the page.</p>
        </div>
      )}
    </div>
  )
}