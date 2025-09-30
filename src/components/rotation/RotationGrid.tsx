// src/components/rotation/RotationGrid.tsx
'use client'

import { Rotation, DAY_NAMES_SHORT, RotationGridData } from '@/types/rotation'
import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ShiftSelectorModal from './ShiftSelectorModal'

interface RotationGridProps {
  rotations: Rotation[]
  durationWeeks: number
  planId: string
}

export default function RotationGrid({ rotations, durationWeeks, planId }: RotationGridProps) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedCell, setSelectedCell] = useState<{
    week: number
    day: number
    rotationId?: string
  } | null>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [loadingShifts, setLoadingShifts] = useState(true)

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

  // Fetch shifts for this plan
  useEffect(() => {
    async function fetchShifts() {
      setLoadingShifts(true)
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('plan_id', planId)
        .order('is_default', { ascending: false })
        .order('name')

      if (error) {
        console.error('Error fetching shifts:', error)
      } else {
        setShifts(data || [])
      }
      setLoadingShifts(false)
    }

    fetchShifts()
  }, [planId, supabase])

  const handleCellClick = (weekIndex: number, dayOfWeek: number) => {
    const rotation = gridData[weekIndex]?.[dayOfWeek]
    
    setSelectedCell({
      week: weekIndex,
      day: dayOfWeek,
      rotationId: rotation?.id
    })
  }

  const handleShiftSelect = async (shiftId: string | null) => {
    if (!selectedCell) return

    try {
      const rotation = gridData[selectedCell.week]?.[selectedCell.day]

      if (rotation) {
        // Update existing rotation
        const { error } = await supabase
          .from('rotations')
          .update({ shift_id: shiftId })
          .eq('id', rotation.id)

        if (error) throw error
      } else {
        // Create new rotation
        const { error } = await supabase
          .from('rotations')
          .insert({
            plan_id: planId,
            week_index: selectedCell.week,
            day_of_week: selectedCell.day,
            shift_id: shiftId
          })

        if (error) throw error
      }

      // Refresh the page to show updated data
      router.refresh()
      setSelectedCell(null)
    } catch (error) {
      console.error('Error updating rotation:', error)
      alert('Failed to update shift')
    }
  }

  // Get shift by ID
  const getShiftById = (shiftId: string | null) => {
    if (!shiftId) return null
    return shifts.find(s => s.id === shiftId)
  }

  // Format shift display
  const formatShiftDisplay = (shift: any) => {
    if (!shift) return null
    
    if (shift.is_default) {
      return shift.name
    }
    
    const start = shift.start_time ? shift.start_time.substring(0, 5) : ''
    const end = shift.end_time ? shift.end_time.substring(0, 5) : ''
    return `${shift.name} (${start}-${end})`
  }

  if (loadingShifts) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading shifts...</div>
      </div>
    )
  }

  return (
    <>
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
                  const shift = rotation?.shift_id ? getShiftById(rotation.shift_id) : null
                  const isSelected = selectedCell?.week === weekIndex && selectedCell?.day === dayIndex
                  
                  return (
                    <td 
                      key={dayIndex}
                      onClick={() => handleCellClick(weekIndex, dayIndex)}
                      className={`
                        border border-gray-300 px-3 py-4 text-center text-sm cursor-pointer
                        transition-all hover:bg-blue-50 hover:shadow-inner
                        ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset' : 'bg-white'}
                        ${shift ? 'bg-green-50 hover:bg-green-100' : ''}
                      `}
                    >
                      {shift ? (
                        <div>
                          <div className={`font-semibold ${shift.is_default ? 'text-gray-800' : 'text-indigo-800'}`}>
                            {shift.name}
                          </div>
                          {!shift.is_default && shift.start_time && shift.end_time && (
                            <div className="text-xs text-gray-600 mt-1">
                              {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-xs py-2">
                          Click to assign
                        </div>
                      )}
                      {rotation?.notes && (
                        <div className="text-xs text-gray-500 mt-1 truncate italic">
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
            <p>No rotation data found. Click on any cell to start assigning shifts.</p>
          </div>
        )}
      </div>

      {/* Shift Selector Modal */}
      {selectedCell && (
        <ShiftSelectorModal
          shifts={shifts}
          currentShiftId={gridData[selectedCell.week]?.[selectedCell.day]?.shift_id || null}
          weekIndex={selectedCell.week}
          dayOfWeek={selectedCell.day}
          onSelect={handleShiftSelect}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </>
  )
}