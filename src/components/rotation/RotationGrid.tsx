// src/components/rotation/RotationGrid.tsx
'use client'

import { Rotation, DAY_NAMES_SHORT_NORWEGIAN, RotationGridData, OverlayType } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { useMemo, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ShiftSelectorModal from './ShiftSelectorModal'
import { 
  calculateShiftHours, 
  shiftCrossesMidnight, 
  calculateHoursBeforeMidnight, 
  calculateHoursAfterMidnight 
} from '@/lib/utils/shiftCalculations'

interface RotationGridProps {
  rotations: Rotation[]
  durationWeeks: number
  planId: string
  planType: 'main' | 'helping' | 'year'
}

export default function RotationGrid({ rotations, durationWeeks, planId, planType }: RotationGridProps) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedCell, setSelectedCell] = useState<{
    week: number
    day: number
    rotationId?: string
  } | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
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

  // Calculate weekly hours
  const weeklyHours = useMemo(() => {
    const hours: { [week: number]: number } = {}
    
    for (let week = 0; week < durationWeeks; week++) {
      let totalHours = 0
      
      for (let day = 0; day < 7; day++) {
        const rotation = gridData[week]?.[day]
        if (rotation?.shift_id) {
          const shift = shifts.find(s => s.id === rotation.shift_id)
          if (shift) {
            const crossesMidnight = shiftCrossesMidnight(shift.start_time, shift.end_time)
            
            // Only split hours between weeks if it's a Monday night shift
            if (crossesMidnight && day === 0) {
              // Monday night shift - split between weeks
              // Add hours after midnight to current week
              totalHours += calculateHoursAfterMidnight(shift.start_time, shift.end_time)
              
              // Add hours before midnight to previous week
              const hoursBeforeMidnight = calculateHoursBeforeMidnight(shift.start_time, shift.end_time)
              
              if (week === 0) {
                // First week Monday - wrap to last week
                hours[durationWeeks - 1] = (hours[durationWeeks - 1] || 0) + hoursBeforeMidnight
              } else {
                // Regular Monday - add to previous week
                hours[week - 1] = (hours[week - 1] || 0) + hoursBeforeMidnight
              }
            } else {
              // All other shifts (including non-Monday night shifts) - add full hours to current week
              totalHours += calculateShiftHours(shift.start_time, shift.end_time)
            }
          }
        }
      }
      
      hours[week] = (hours[week] || 0) + totalHours
    }
    
    return hours
  }, [gridData, durationWeeks, shifts])

  // Calculate grand total
  const grandTotal = useMemo(() => {
    return Object.values(weeklyHours).reduce((sum, hours) => sum + hours, 0)
  }, [weeklyHours])

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

const handleShiftSelect = async (
  shiftId: string | null,
  overlayData?: { overlayType?: OverlayType }
) => {
  if (!selectedCell) return

  try {
    const rotation = gridData[selectedCell.week]?.[selectedCell.day]

    if (overlayData?.overlayType && rotation?.shift_id) {
      // 🟣 Apply as overlay (keeping the original shift)
      const updateData = {
        overlay_shift_id: shiftId,
        overlay_type: overlayData.overlayType
      }

      const { error } = await supabase
        .from('rotations')
        .update(updateData)
        .eq('id', rotation.id)

      if (error) throw error
    } else {
      // 🔵 Replace or clear shift (normal assignment)
      const updateData = {
        shift_id: shiftId,
        overlay_shift_id: null,
        overlay_type: null
      }

      if (rotation) {
        // Update existing rotation
        const { error } = await supabase
          .from('rotations')
          .update(updateData)
          .eq('id', rotation.id)

        if (error) throw error
      } else {
        // Create new rotation record
        const { error } = await supabase
          .from('rotations')
          .insert({
            plan_id: planId,
            week_index: selectedCell.week,
            day_of_week: selectedCell.day,
            ...updateData
          })

        if (error) throw error
      }
    }

    // ✅ Refresh to reflect updates
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

  if (loadingShifts) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Laster vakter...</div>
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
                Veke
              </th>
              {DAY_NAMES_SHORT_NORWEGIAN.map((day, index) => (
                <th 
                  key={index}
                  className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 min-w-[120px]"
                >
                  {day}
                </th>
              ))}
              <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-indigo-700 min-w-[100px] bg-indigo-50">
                Veke timar
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: durationWeeks }, (_, weekIndex) => (
              <tr key={weekIndex}>
                <td className="sticky left-0 z-10 bg-gray-50 border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900">
                  Veke {weekIndex + 1}
                </td>
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const rotation = gridData[weekIndex]?.[dayIndex]
                  const originalShift = rotation?.shift_id ? getShiftById(rotation.shift_id) : null
                  const overlayShift = rotation?.overlay_shift_id ? getShiftById(rotation.overlay_shift_id) : null
                  const isSelected = selectedCell?.week === weekIndex && selectedCell?.day === dayIndex

                  const getShiftDisplay = () => {
                    // Check for overlay shift first
                    if (overlayShift && originalShift) {
                      return {
                        text: `(${originalShift.name}) ${overlayShift.name}`,
                        hasOverlay: true,
                        isF3: overlayShift.name === 'F3',
                        isF4: overlayShift.name === 'F4',
                        isF5: overlayShift.name === 'F5',
                        isFE: overlayShift.name === 'FE',
                        isVacation: rotation.overlay_type === 'vacation'
                      }
                    } else if (overlayShift) {
                      // Overlay without original (shouldn't happen normally)
                      return {
                        text: overlayShift.name,
                        hasOverlay: false,
                        isFE: overlayShift.name === 'FE'
                      }
                    } else if (originalShift) {
                      // Check if this is FE placed as a regular shift
                      const isFE = originalShift.name === 'FE'
                      return {
                        text: originalShift.name,
                        hasOverlay: false,
                        isFE: isFE,
                        isVacation: isFE // Treat standalone FE as vacation
                      }
                    }
                    return null
                  }

                  const shiftDisplay = getShiftDisplay()

                  return (
                    <td 
                      key={dayIndex}
                      onClick={() => handleCellClick(weekIndex, dayIndex)}
                      className={`
                        border border-gray-300 px-3 py-4 text-center text-sm cursor-pointer
                        transition-all hover:bg-blue-50 hover:shadow-inner
                        ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset' : 'bg-white'}
                        ${shiftDisplay?.hasOverlay ? 'bg-purple-50' : ''}
                        ${shiftDisplay?.isVacation || shiftDisplay?.isFE ? 'bg-green-50' : ''}
                      `}
                    >
                      {shiftDisplay ? (
                        <div>
                          <div
                            className={`
                              font-semibold 
                              ${shiftDisplay.hasOverlay ? 'text-purple-800' : ''}
                              ${shiftDisplay.isFE && !shiftDisplay.hasOverlay ? 'text-green-800' : ''}
                              ${originalShift?.is_default && !shiftDisplay.isFE ? 'text-gray-800' : 'text-indigo-800'}
                            `}
                          >
                            {shiftDisplay.text}
                          </div>

                          {!originalShift?.is_default && originalShift?.start_time && originalShift?.end_time && !shiftDisplay.hasOverlay && !shiftDisplay.isFE && (
                            <div className="text-xs text-gray-600 mt-1">
                              {originalShift.start_time.substring(0, 5)} - {originalShift.end_time.substring(0, 5)}
                            </div>
                          )}

                          {/* Display overlay indicators */}
                          {shiftDisplay.hasOverlay && (
                            <div className="text-xs text-purple-600 mt-1">
                              {rotation.overlay_type === 'f3_compensation' && '⚖️ Holiday compensation'}
                              {rotation.overlay_type === 'f4_compensation' && '💰 Compensation'}
                              {rotation.overlay_type === 'f5_replacement' && '🔄 Replacement day'}
                              {rotation.overlay_type === 'vacation' && overlayShift?.name === 'FE' && '🏖️ Ferie'}
                              {rotation.overlay_type === 'vacation' && overlayShift?.name !== 'FE' && '🏖️ Vacation'}
                              {rotation.overlay_type === 'other' && '📝 Other'}
                            </div>
                          )}
                          
                          {/* Display FE indicator when placed as standalone */}
                          {shiftDisplay.isFE && !shiftDisplay.hasOverlay && (
                            <div className="text-xs text-green-600 mt-1">
                              🏖️ Ferie
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-xs py-2">
                          Klikk for å velje vakt
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold bg-indigo-50 text-indigo-900">
                  {weeklyHours[weekIndex]?.toFixed(2) || '0.0'}t
                </td>
              </tr>
            ))}
            
            {/* Summary Row */}
            <tr className="bg-gray-100">
              <td className="sticky left-0 z-10 bg-gray-200 border border-gray-300 px-4 py-3 text-sm font-bold text-gray-900">
                Total
              </td>
              {Array.from({ length: 7 }, (_, dayIndex) => (
                <td 
                  key={dayIndex}
                  className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-900"
                >
                  -
                </td>
              ))}
              <td className="border border-gray-300 px-4 py-3 text-center text-sm font-bold bg-indigo-100 text-indigo-900">
                {grandTotal.toFixed(2)}t
              </td>
            </tr>
          </tbody>
        </table>
        
        {rotations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Ingen data i turnus. Trykk på ei celle for å starte.</p>
          </div>
        )}
      </div>

      {/* Shift Selector Modal */}
      {selectedCell && (
        <ShiftSelectorModal
          shifts={shifts}
          currentShiftId={gridData[selectedCell.week]?.[selectedCell.day]?.shift_id || null}
          currentRotation={gridData[selectedCell.week]?.[selectedCell.day]} // ✅ ADD THIS LINE
          weekIndex={selectedCell.week}
          dayOfWeek={selectedCell.day}
          planType={planType}
          onSelect={handleShiftSelect}
          onSelectOverlay={(shiftId, overlayType) => 
            handleShiftSelect(shiftId, { overlayType }) // ✅ Hook overlay into existing logic
          }
          onRemoveOverlay={async () => {
            const rotation = gridData[selectedCell.week]?.[selectedCell.day]
            if (!rotation) return

            try {
              const { error } = await supabase
                .from('rotations')
                .update({ overlay_shift_id: null, overlay_type: null })
                .eq('id', rotation.id)

              if (error) throw error

              router.refresh()
              setSelectedCell(null)
            } catch (err) {
              console.error('Error removing overlay:', err)
            }
          }}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </>
  )
}