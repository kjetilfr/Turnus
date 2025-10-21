'use client'

import { useState } from 'react'
import { DAY_NAMES_SHORT_NORWEGIAN } from '@/types/rotation'
import { Rotation, OverlayType } from '@/types/rotation'
import { AUTO_OVERLAY_SHIFTS } from '@/lib/constants/defaultShifts'

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
  currentRotation?: Rotation
  weekIndex: number
  dayOfWeek: number
  planType: 'main' | 'helping' | 'year'
  onSelect: (shiftId: string | null) => void
  onSelectOverlay?: (shiftId: string | null, overlayType: OverlayType) => void
  onRemoveOverlay?: () => void
  onClose: () => void
}

export default function ShiftSelectorModal({
  shifts,
  currentShiftId,
  currentRotation,
  weekIndex,
  dayOfWeek,
  planType,
  onSelect,
  onSelectOverlay,
  onRemoveOverlay,
  onClose
}: ShiftSelectorModalProps) {
  const [mode] = useState<'replace' | 'overlay'>('replace')
  const [overlayType] = useState<OverlayType>('f3_compensation')

  const defaultShifts = shifts.filter(s => s.is_default)
  const customShifts = shifts.filter(s => !s.is_default)

  const hasOriginalShift = currentRotation?.shift_id && !currentRotation?.overlay_shift_id
  const hasOverlay = currentRotation?.overlay_shift_id

  const originalShift = currentRotation?.shift_id 
    ? shifts.find(s => s.id === currentRotation.shift_id)
    : null

  const overlayShift = currentRotation?.overlay_shift_id 
    ? shifts.find(s => s.id === currentRotation.overlay_shift_id)
    : null

  // Check if a shift should auto-overlay
  const isAutoOverlayShift = (shiftName: string) => {
    return (AUTO_OVERLAY_SHIFTS as readonly string[]).includes(shiftName)
  }

  // Check if a shift requires an existing base shift
  const requiresBaseShift = (shiftName: string) => {
    // F3, F4, F5 require a base shift, but FE (Ferie) doesn't
    return ['F3', 'F4', 'F5'].includes(shiftName)
  }

  // Determine overlay type based on shift name
  const getOverlayTypeForShift = (shiftName: string): OverlayType => {
    if (shiftName === 'F3') return 'f3_compensation'
    if (shiftName === 'F4') return 'f4_compensation'
    if (shiftName === 'F5') return 'f5_replacement'
    if (shiftName === 'FE') return 'vacation'
    return 'other'
  }

  const handleShiftSelection = (shiftId: string, shiftName: string) => {
    // Block F3/F4/F5/FE on main plans
    if (planType === 'main' && ['F3', 'F4', 'F5', 'FE'].includes(shiftName)) return

    // Auto-overlay logic for F3/F4/F5/FE
    if (isAutoOverlayShift(shiftName)) {
      // Check if this shift requires a base shift
      if (requiresBaseShift(shiftName) && !hasOriginalShift && !currentShiftId) {
        // F3/F4/F5 cannot be placed on empty day
        alert(`${shiftName} can only be placed on days with existing shifts`)
        return
      }
      
      // For FE or other auto-overlay shifts with a base shift, apply as overlay
      if ((shiftName === 'FE' && (hasOriginalShift || currentShiftId)) || 
          (requiresBaseShift(shiftName) && (hasOriginalShift || currentShiftId))) {
        if (onSelectOverlay) {
          const overlayType = getOverlayTypeForShift(shiftName)
          onSelectOverlay(shiftId, overlayType)
        }
      } else if (shiftName === 'FE' && !hasOriginalShift && !currentShiftId) {
        // FE can be placed on empty days as a regular shift but with vacation overlay type
        if (onSelectOverlay) {
          onSelectOverlay(shiftId, 'vacation')
        } else {
          onSelect(shiftId)
        }
      }
      return
    }

    // Regular shift selection logic
    if (mode === 'overlay' && hasOriginalShift && onSelectOverlay) {
      onSelectOverlay(shiftId, overlayType)
    } else {
      onSelect(shiftId)
    }
  }

  const handleRemoveShift = () => onSelect(null)
  const handleRemoveOverlay = () => onRemoveOverlay && onRemoveOverlay()
  
  const formatTime = (time: string | null) => time?.substring(0, 5) || ''
  
  const isShiftDisabled = (shift: Shift) => {
    // Disable F3/F4/F5/FE on main plans
    if (planType === 'main' && shift.is_default && ['F3', 'F4', 'F5', 'FE'].includes(shift.name)) {
      return true
    }
    
    // Disable F3/F4/F5 if there's no base shift (but not FE)
    if (requiresBaseShift(shift.name) && !hasOriginalShift && !currentShiftId) {
      return true
    }
    
    return false
  }

  // Check if manual overlay selection should be shown
  hasOriginalShift && 
    !['F3', 'F4', 'F5', 'FE'].includes(originalShift?.name || '')

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
            <h2 className="text-lg font-semibold text-gray-900">Velg vakt</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Veke {weekIndex + 1} - {DAY_NAMES_SHORT_NORWEGIAN[dayOfWeek]}
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

        {/* Remove Overlay Section */}
        {hasOverlay && (
          <div className="p-4 bg-yellow-50 border-b border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-yellow-900">Current Overlay</div>
                <div className="text-sm text-yellow-700">
                  ({originalShift?.name}) {overlayShift?.name}
                </div>
              </div>
              <button
                onClick={handleRemoveOverlay}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
              >
                Fjern overskrivning
              </button>
            </div>
          </div>
        )}

        {/* Shift List */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          {shifts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">⏰</div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Ingen vakter tilgjengeleg</h3>
              <p className="text-sm text-gray-600 mb-4">
                Du må lage eller importere vakter før du kan starte.
              </p>
              <button
                onClick={onClose}
                className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
              >
                Tilbake
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current Shift */}
              {currentShiftId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-blue-900 mb-0.5">Gjeldende vakt</div>
                      <div className="text-sm text-blue-700">
                        {shifts.find(s => s.id === currentShiftId)?.name || 'Unknown'}
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveShift}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      Fjern
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
                      <strong>NB:</strong> F3-F5 og FE vakter kan kun brukes på hjelpeturnus og årsturnus.
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-overlay info */}
              {(planType === 'helping' || planType === 'year') && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex gap-2">
                    <svg className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-purple-900">
                      <strong>Automatisk erstatning:</strong>
                      <ul className="mt-1 space-y-0.5">
                        <li>• F3, F4, F5 erstatter vakter og blir difor plassert på toppen av vakter og kan difor ikkje brukast på dagar utan vakt.</li>
                        <li>• FE (Ferie): Dersom det eksisterer vakt blir denne erstatta med FE, men blir også brukt på dagar utan vakt.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Default Shifts */}
              {defaultShifts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Forhandsinnstilte vakter
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {defaultShifts.map((shift) => {
                      const disabled = isShiftDisabled(shift)
                      const isAutoOverlay = isAutoOverlayShift(shift.name)
                      
                      return (
                        <button
                          key={shift.id}
                          onClick={() => handleShiftSelection(shift.id, shift.name)}
                          disabled={disabled}
                          className={`
                            p-2 border-2 rounded-lg text-left transition-all relative
                            ${disabled 
                              ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed' 
                              : currentShiftId === shift.id 
                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                                : isAutoOverlay
                                  ? 'border-purple-300 hover:border-purple-400 hover:bg-purple-50'
                                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }
                          `}
                        >
                          {isAutoOverlay && !disabled && (
                            <div className="absolute -top-1 -right-1">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-600 text-white">
                                Auto erstatt
                              </span>
                            </div>
                          )}
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
                    Eigendefinerte vakter
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {customShifts.map((shift) => (
                      <button
                        key={shift.id}
                        onClick={() => handleShiftSelection(shift.id, shift.name)}
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
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}