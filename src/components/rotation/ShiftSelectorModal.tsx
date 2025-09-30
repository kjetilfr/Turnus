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
  planType: 'main' | 'helping' | 'year'
  onSelect: (shiftId: string | null) => void
  onClose: () => void
}

export default function ShiftSelectorModal({
  shifts,
  currentShiftId,
  weekIndex,
  dayOfWeek,
  planType,
  onSelect,
  onClose
}: ShiftSelectorModalProps) {
  const defaultShifts = shifts.filter(s => s.is_default)
  const customShifts = shifts.filter(s => !s.is_default)

  const handleShiftClick = (shiftId: string, shiftName: string) => {
    // Prevent selecting F3-F5 in main plans
    if (planType === 'main' && ['F3', 'F4', 'F5'].includes(shiftName)) {
      return
    }
    onSelect(shiftId)
  }

  const handleRemoveShift = () => {
    onSelect(null)
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5)
  }

  const isShiftDisabled = (shift: Shift) => {
    return planType === 'main' && shift.is_default && ['F3', 'F4', 'F5'].includes(shift.name)
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Select Shift</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Week {weekIndex + 1} - {DAY_NAMES_SHORT[dayOfWeek]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          {shifts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">⏰</div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">No Shifts Available</h3>
              <p className="text-sm text-gray-600 mb-4">
                You need to create shifts before you can assign them to the rotation.
              </p>
              <button
                onClick={onClose}
                className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
              >
                Go back
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current Shift & Remove Option */}
              {currentShiftId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-blue-900 mb-0.5">Current Shift</div>
                      <div className="text-sm text-blue-700">
                        {shifts.find(s => s.id === currentShiftId)?.name || 'Unknown'}
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveShift}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {/* Info for Main Plans */}
              {planType === 'main' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex gap-2">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-amber-900">
                      <strong>Note:</strong> F3-F5 shifts are only available for helping and year plans.
                    </div>
                  </div>
                </div>
              )}

              {/* Default Shifts */}
              {defaultShifts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Default Shifts
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {defaultShifts.map((shift) => {
                      const disabled = isShiftDisabled(shift)
                      return (
                        <button
                          key={shift.id}
                          onClick={() => handleShiftClick(shift.id, shift.name)}
                          disabled={disabled}
                          className={`
                            p-2 border-2 rounded-lg text-left transition-all
                            ${disabled 
                              ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed' 
                              : currentShiftId === shift.id 
                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }
                          `}
                        >
                          <div className={`font-semibold text-sm ${disabled ? 'text-gray-500' : 'text-gray-900'}`}>
                            {shift.name}
                          </div>
                          {shift.description && (
                            <div className={`text-xs mt-0.5 line-clamp-1 ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
                              {shift.description}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Custom Shifts */}
              {customShifts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Custom Shifts
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {customShifts.map((shift) => (
                      <button
                        key={shift.id}
                        onClick={() => handleShiftClick(shift.id, shift.name)}
                        className={`
                          p-2 border-2 rounded-lg text-left transition-all
                          ${currentShiftId === shift.id 
                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                            : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-900 truncate">{shift.name}</div>
                            {shift.description && (
                              <div className="text-xs text-gray-600 mt-0.5 line-clamp-1">{shift.description}</div>
                            )}
                          </div>
                          {shift.start_time && shift.end_time && (
                            <div className="text-xs font-medium text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-300 whitespace-nowrap flex-shrink-0">
                              {formatTime(shift.start_time)}-{formatTime(shift.end_time)}
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
        <div className="flex justify-end gap-2 p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}