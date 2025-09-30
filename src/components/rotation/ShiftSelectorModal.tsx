// src/components/rotation/ShiftSelectorModal.tsx
'use client'

import { DAY_NAMES_SHORT } from '@/types/rotation'

interface Shift {
  id: string
  name: string
  description: string | null
  start_time: string | null
  end_time: string | null
  is_default: boolean
}

interface ShiftSelectorModalProps {
  shifts: Shift[]
  currentShiftId: string | null
  weekIndex: number
  dayOfWeek: number
  onSelect: (shiftId: string | null) => void
  onClose: () => void
}

export default function ShiftSelectorModal({
  shifts,
  currentShiftId,
  weekIndex,
  dayOfWeek,
  onSelect,
  onClose
}: ShiftSelectorModalProps) {
  const defaultShifts = shifts.filter(s => s.is_default)
  const customShifts = shifts.filter(s => !s.is_default)

  const handleShiftClick = (shiftId: string) => {
    onSelect(shiftId)
  }

  const handleRemoveShift = () => {
    onSelect(null)
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5)
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Select Shift</h2>
            <p className="text-sm text-gray-600 mt-1">
              Week {weekIndex + 1} - {DAY_NAMES_SHORT[dayOfWeek]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {shifts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⏰</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Shifts Available</h3>
              <p className="text-gray-600 mb-4">
                You need to create shifts before you can assign them to the rotation.
              </p>
              <button
                onClick={onClose}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Go back
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Shift & Remove Option */}
              {currentShiftId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-900 mb-1">Current Shift</div>
                      <div className="text-sm text-blue-700">
                        {shifts.find(s => s.id === currentShiftId)?.name || 'Unknown'}
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveShift}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Remove Shift
                    </button>
                  </div>
                </div>
              )}

              {/* Default Shifts */}
              {defaultShifts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Default Shifts
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {defaultShifts.map((shift) => (
                      <button
                        key={shift.id}
                        onClick={() => handleShiftClick(shift.id)}
                        className={`
                          p-4 border-2 rounded-lg text-left transition-all
                          ${currentShiftId === shift.id 
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="font-semibold text-gray-900">{shift.name}</div>
                        {shift.description && (
                          <div className="text-xs text-gray-600 mt-1">{shift.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Shifts */}
              {customShifts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Custom Shifts
                  </h3>
                  <div className="space-y-2">
                    {customShifts.map((shift) => (
                      <button
                        key={shift.id}
                        onClick={() => handleShiftClick(shift.id)}
                        className={`
                          w-full p-4 border-2 rounded-lg text-left transition-all
                          ${currentShiftId === shift.id 
                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                            : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{shift.name}</div>
                            {shift.description && (
                              <div className="text-xs text-gray-600 mt-1">{shift.description}</div>
                            )}
                          </div>
                          {shift.start_time && shift.end_time && (
                            <div className="ml-4 text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded-md border border-gray-300">
                              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}