// src/components/shift/ImportRotationModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plan } from '@/types/plan'

interface ImportRotationModalProps {
  planId: string
  basePlanId: string
  onClose: () => void
}

export default function ImportRotationModal({ planId, basePlanId, onClose }: ImportRotationModalProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [helpingPlan, setHelpingPlan] = useState<Plan | null>(null)
  const [basePlan, setBasePlan] = useState<Plan | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [previewMapping, setPreviewMapping] = useState<Array<{helpingWeek: number, baseWeek: number}>>([])

  useEffect(() => {
    async function fetchData() {
      setLoadingData(true)
      try {
        // Fetch helping plan
        const { data: helpingData, error: helpingError } = await supabase
          .from('plans')
          .select('*')
          .eq('id', planId)
          .single()

        if (helpingError) throw helpingError
        setHelpingPlan(helpingData)

        // Fetch base plan
        const { data: baseData, error: baseError } = await supabase
          .from('plans')
          .select('*')
          .eq('id', basePlanId)
          .single()

        if (baseError) throw baseError
        setBasePlan(baseData)

        // Calculate week offset based on start dates
        if (helpingData && baseData) {
          const helpingStart = new Date(helpingData.date_started)
          const baseStart = new Date(baseData.date_started)
          
          // Calculate difference in days
          const diffTime = helpingStart.getTime() - baseStart.getTime()
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          
          // Convert to weeks (can be negative if helping plan starts before base plan)
          const diffWeeks = Math.floor(diffDays / 7)
          
          // Calculate offset (wrapping around base plan's duration)
          let offset = diffWeeks % baseData.duration_weeks
          if (offset < 0) {
            offset += baseData.duration_weeks
          }
          
          setWeekOffset(offset)
          
          // Generate preview mapping
          const mapping = []
          for (let helpingWeek = 0; helpingWeek < helpingData.duration_weeks; helpingWeek++) {
            const baseWeek = (helpingWeek + offset) % baseData.duration_weeks
            mapping.push({ helpingWeek, baseWeek })
          }
          setPreviewMapping(mapping)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plan data')
      } finally {
        setLoadingData(false)
      }
    }

    fetchData()
  }, [planId, basePlanId, supabase])

  const handleImport = async () => {
    if (!helpingPlan || !basePlan) {
      setError('Missing plan data')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch all rotations from base plan
      const { data: baseRotations, error: fetchError } = await supabase
        .from('rotations')
        .select('*')
        .eq('plan_id', basePlanId)
        .order('week_index')
        .order('day_of_week')

      if (fetchError) throw fetchError
      if (!baseRotations || baseRotations.length === 0) {
        throw new Error('No rotations found in base plan')
      }

      // Check if base plan has any shifts assigned
      const hasShifts = baseRotations.some(r => r.shift_id !== null)
      if (!hasShifts) {
        throw new Error('Base plan has no shifts assigned. Please assign shifts to the base plan rotation grid first, then import.')
      }

      // Fetch all shifts from base plan
      const { data: baseShifts, error: baseShiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('plan_id', basePlanId)

      if (baseShiftsError) throw baseShiftsError

      // Fetch all shifts from helping plan
      const { data: helpingShifts, error: helpingShiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('plan_id', planId)

      if (helpingShiftsError) throw helpingShiftsError

      // Create a map of base shift ID to helping shift ID (by matching name and times)
      const shiftIdMap = new Map<string, string>()
      
      baseShifts?.forEach(baseShift => {
        const matchingHelpingShift = helpingShifts?.find(helpingShift => 
          helpingShift.name === baseShift.name &&
          helpingShift.is_default === baseShift.is_default &&
          helpingShift.start_time === baseShift.start_time &&
          helpingShift.end_time === baseShift.end_time
        )
        
        if (matchingHelpingShift) {
          shiftIdMap.set(baseShift.id, matchingHelpingShift.id)
        }
      })

      console.log('Shift ID mapping:', Object.fromEntries(shiftIdMap))

      // Check if all shifts can be mapped
      const unmappedShifts = baseRotations
        .filter(r => r.shift_id !== null)
        .filter(r => !shiftIdMap.has(r.shift_id!))
      
      if (unmappedShifts.length > 0) {
        const uniqueUnmappedShiftIds = [...new Set(unmappedShifts.map(r => r.shift_id))]
        const unmappedShiftNames = uniqueUnmappedShiftIds
          .map(id => baseShifts?.find(s => s.id === id)?.name)
          .filter(Boolean)
        
        throw new Error(
          `Some shifts from the base plan are not available in the helping plan: ${unmappedShiftNames.join(', ')}. ` +
          `Please make sure the helping plan has all the same shifts as the base plan (use "Import Shifts" or "Create Shift").`
        )
      }

      // Delete existing rotations in helping plan
      const { error: deleteError } = await supabase
        .from('rotations')
        .delete()
        .eq('plan_id', planId)

      if (deleteError) throw deleteError

      // Map rotations with week offset and wrapping
      const newRotations: Array<{
        plan_id: string
        week_index: number
        day_of_week: number
        shift_id: string | null
        notes: string | null
      }> = []

      for (let helpingWeek = 0; helpingWeek < helpingPlan.duration_weeks; helpingWeek++) {
        // Calculate which week in the base plan to copy from (with wrapping)
        const baseWeek = (helpingWeek + weekOffset) % basePlan.duration_weeks
        
        // Find all rotations for this base week
        const baseWeekRotations = baseRotations.filter(r => r.week_index === baseWeek)
        
        // Copy each day's rotation
        for (const baseRotation of baseWeekRotations) {
        // Use mapped helping shift_id if available, otherwise null
        const mappedShiftId = baseRotation.shift_id
            ? shiftIdMap.get(baseRotation.shift_id) ?? null
            : null

        newRotations.push({
            plan_id: planId,
            week_index: helpingWeek,
            day_of_week: baseRotation.day_of_week,
            shift_id: mappedShiftId,
            notes: baseRotation.notes,
        })
        }
      }

      console.log('Rotations to insert:', newRotations.length)
      console.log('Sample rotation:', newRotations[0])

      // Insert new rotations in batches to avoid timeout
      if (newRotations.length > 0) {
        const batchSize = 100
        let insertedCount = 0
        
        for (let i = 0; i < newRotations.length; i += batchSize) {
          const batch = newRotations.slice(i, i + batchSize)
          console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}, rows ${i} to ${i + batch.length}`)
          
          const { error: insertError } = await supabase
            .from('rotations')
            .insert(batch)
            .select()

          if (insertError) {
            console.error('Insert error details:', insertError)
            throw new Error(`Failed to insert rotations: ${insertError.message}`)
          }
          
          insertedCount += batch.length
          console.log(`Successfully inserted ${insertedCount}/${newRotations.length} rotations`)
        }
        
        console.log('All rotations inserted successfully!')
      } else {
        throw new Error('No rotations to insert')
      }

      // Success
      router.refresh()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import rotation')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="text-center py-8">
            <div className="text-gray-500">Laster turnus data...</div>
          </div>
        </div>
      </div>
    )
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
            <h2 className="text-xl font-semibold text-gray-900">Importer turnus frå hovudturnus</h2>
            <p className="text-sm text-gray-600 mt-1">Kopier turnus med automatisk vekeoverføring</p>
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
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg border border-red-200 text-sm">
              {error}
            </div>
          )}

          {helpingPlan && basePlan && (
            <div className="space-y-6">
              {/* Plan Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-blue-900 mb-1">Hovudturnus</div>
                    <div className="text-blue-800">{basePlan.name}</div>
                    <div className="text-blue-700 text-xs mt-1">
                      Startar: {new Date(basePlan.date_started).toLocaleDateString('en-GB')}
                    </div>
                    <div className="text-blue-700 text-xs">
                      Varigheit: {basePlan.duration_weeks} veker
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-green-900 mb-1">Hjelpeturnus</div>
                    <div className="text-green-800">{helpingPlan.name}</div>
                    <div className="text-green-700 text-xs mt-1">
                      Startar: {new Date(helpingPlan.date_started).toLocaleDateString('en-GB')}
                    </div>
                    <div className="text-green-700 text-xs">
                      Varigheit: {helpingPlan.duration_weeks} veker
                    </div>
                  </div>
                </div>
              </div>

              {/* Week Offset Info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg 
                    className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  <div className="flex-1">
                    <div className="font-semibold text-purple-900 mb-1">Vekejustering</div>
                    <div className="text-sm text-purple-800">
                      {weekOffset === 0 ? (
                        <>Begge turnusar har same start dato. Hjelpeturnus veke 1 kopierer hovudturnus veke 1.</>
                      ) : (
                        <>
                          Hjelpeturnusen startar {weekOffset} veke{weekOffset !== 1 ? 's' : ''} etter hovudturnus. 
                          Hjelpeturnus Veke 1 vil kopiere hovudturnus veke {weekOffset + 1}.
                        </>
                      )}
                    </div>
                    <div className="text-xs text-purple-700 mt-2">
                      Hovudturnusen vil starte på nytt på veke 1 dersom det ikkje er nok veker til å fylle heile turnusen.
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Mapping */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Forhandsvisning vekekartlegging</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-semibold text-gray-700">Hjelpe Veke</div>
                    <div className="font-semibold text-gray-700">← Hovud Veke</div>
                    {previewMapping.slice(0, 12).map((mapping) => (
                      <div key={mapping.helpingWeek} className="contents">
                        <div className="text-gray-900">Veke {mapping.helpingWeek + 1}</div>
                        <div className="text-gray-900">← Veke {mapping.baseWeek + 1}</div>
                      </div>
                    ))}
                    {previewMapping.length > 12 && (
                      <div className="col-span-2 text-center text-gray-500 text-xs italic mt-2">
                        ... og {previewMapping.length - 12} fleire veker
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg 
                    className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                    />
                  </svg>
                  <div className="text-sm text-yellow-900">
                    <div className="font-semibold mb-1">Advarsel!</div>
                    <div>Du vil no overksrive heile turnusen. Du kan ikkje angre!</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !helpingPlan || !basePlan}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importerer...' : 'Importer Turnus'}
          </button>
        </div>
      </div>
    </div>
  )
}