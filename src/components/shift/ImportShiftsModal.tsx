// src/components/shift/ImportShiftsModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shift } from '@/types/shift'

interface Plan {
  id: string
  name: string
  type: string
}

interface ImportShiftsModalProps {
  currentPlanId: string
  onClose: () => void
}

export default function ImportShiftsModal({ currentPlanId, onClose }: ImportShiftsModalProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set())
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all user's plans except the current one
  useEffect(() => {
    async function fetchPlans() {
      setLoadingPlans(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { data, error } = await supabase
          .from('plans')
          .select('id, name, type')
          .eq('user_id', user.id)
          .neq('id', currentPlanId)
          .order('name')

        if (error) throw error
        setPlans(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Klarte ikkje å laste inn turnusar')
      } finally {
        setLoadingPlans(false)
      }
    }

    fetchPlans()
  }, [currentPlanId, supabase])

  // Fetch shifts when a plan is selected
  useEffect(() => {
    async function fetchShifts() {
      if (!selectedPlanId) {
        setAvailableShifts([])
        return
      }

      setLoadingShifts(true)
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('plan_id', selectedPlanId)
          .eq('is_default', false)
          .order('name')

        if (error) throw error
        setAvailableShifts(data || [])
        setSelectedShifts(new Set())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Klarte ikkje å importere vakter')
      } finally {
        setLoadingShifts(false)
      }
    }

    fetchShifts()
  }, [selectedPlanId, supabase])

  const toggleShiftSelection = (shiftId: string) => {
    const newSelection = new Set(selectedShifts)
    if (newSelection.has(shiftId)) {
      newSelection.delete(shiftId)
    } else {
      newSelection.add(shiftId)
    }
    setSelectedShifts(newSelection)
  }

  const selectAll = () => {
    setSelectedShifts(new Set(availableShifts.map(s => s.id)))
  }

  const deselectAll = () => {
    setSelectedShifts(new Set())
  }

  const handleImport = async () => {
    if (selectedShifts.size === 0) {
      setError('Velg minst ei vakt å importere')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const shiftsToImport = availableShifts.filter(s => selectedShifts.has(s.id))

      // Import shifts one at a time to better handle errors
      for (const shift of shiftsToImport) {
        const newShift = {
          plan_id: currentPlanId,
          name: shift.name,
          description: shift.description || null,
          start_time: shift.start_time,
          end_time: shift.end_time,
          is_default: false
        }

        const { data, error: insertError } = await supabase
          .from('shifts')
          .insert([newShift])
          .select()

        if (insertError) {
          console.error('Insert error for shift:', shift.name, insertError)
          throw new Error(`Failed to import shift "${shift.name}": ${insertError.message || 'Unknown error'}`)
        }

        if (!data || data.length === 0) {
          throw new Error(`Failed to import shift "${shift.name}": No data returned`)
        }
      }

      router.refresh()
      onClose()
    } catch (err) {
      console.error('Import error:', err)
      setError(err instanceof Error ? err.message : 'Failed to import shifts. Please check your permissions.')
    } finally {
      setLoading(false)
    }
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
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Importer vakter</h2>
            <p className="text-sm text-gray-600 mt-1">Kopier vakter frå ein anna turnus</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Select Plan */}
          <div>
            <label htmlFor="sourcePlan" className="block text-sm font-medium text-gray-700 mb-2">
              Velg turnus
            </label>
            {loadingPlans ? (
              <div className="text-sm text-gray-500">Lastar turnusar...</div>
            ) : plans.length === 0 ? (
              <div className="p-4 bg-gray-50 text-gray-600 rounded-lg border border-gray-200 text-sm">
                Ingen turnusar å velje.
              </div>
            ) : (
              <select
                id="sourcePlan"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Velg ein turnus...</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Shifts Selection */}
          {selectedPlanId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Velg vakter å importere
                </label>
                {availableShifts.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Velg Alle
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                    >
                      Avmerk Alle
                    </button>
                  </div>
                )}
              </div>

              {loadingShifts ? (
                <div className="text-sm text-gray-500">Laster vakter...</div>
              ) : availableShifts.length === 0 ? (
                <div className="p-4 bg-gray-50 text-gray-600 rounded-lg border border-gray-200 text-sm">
                  Ingen eigendefinerte vakter i denne turnusen.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {availableShifts.map((shift) => (
                    <label
                      key={shift.id}
                      className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedShifts.has(shift.id) ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedShifts.has(shift.id)}
                        onChange={() => toggleShiftSelection(shift.id)}
                        className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-gray-900">{shift.name}</div>
                          <div className="text-xs font-medium text-gray-700 bg-white px-2 py-1 rounded border border-gray-300 whitespace-nowrap">
                            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                          </div>
                        </div>
                        {shift.description && (
                          <div className="text-sm text-gray-600 mt-1">{shift.description}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selectedShifts.size > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {selectedShifts.size} shift{selectedShifts.size !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleImport}
            disabled={loading || selectedShifts.size === 0 || !selectedPlanId}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importerer...' : `Importer ${selectedShifts.size > 0 ? selectedShifts.size + ' ' : ''}Vakt${selectedShifts.size !== 1 ? 'er' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}