// src/components/plan/PlanDetails.tsx
'use client'

import { Plan } from '@/types/plan'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PlanDetailsProps {
  plan: Plan
  basePlanName?: string | null
  activePage?: 'rotation' | 'calendar' | 'lawChecks'
}

export default function PlanDetails({ 
  plan, 
  basePlanName,
  activePage = 'rotation'
}: PlanDetailsProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [newStartDate, setNewStartDate] = useState(plan.date_started)
  const [isSaving, setIsSaving] = useState(false)
  const [relatedPlan, setRelatedPlan] = useState<{ id: string; name: string } | null>(null)
  const [loadingRelatedPlan, setLoadingRelatedPlan] = useState(false)

  // Check if this is a rotation-based year plan or its helping plan
  const isRotationYearPlan = plan.type === 'year' && plan.year_plan_mode === 'rotation_based'
  const isHelpingPlanOfRotationYear = plan.type === 'helping' && plan.base_plan_id

  useEffect(() => {
    // Fetch the related plan (helping plan if this is year plan, or base plan if this is helping plan)
    async function fetchRelatedPlan() {
      if (isRotationYearPlan) {
        // This is the rotation year plan - find its helping plan
        setLoadingRelatedPlan(true)
        const { data, error } = await supabase
          .from('plans')
          .select('id, name')
          .eq('base_plan_id', plan.id)
          .eq('type', 'helping')
          .single()

        if (!error && data) {
          setRelatedPlan(data)
        }
        setLoadingRelatedPlan(false)
      } else if (isHelpingPlanOfRotationYear && plan.base_plan_id) {
        // This is the helping plan - check if base plan is rotation-based year plan
        setLoadingRelatedPlan(true)
        const { data, error } = await supabase
          .from('plans')
          .select('id, name, type, year_plan_mode')
          .eq('id', plan.base_plan_id)
          .single()

        if (!error && data && data.type === 'year' && data.year_plan_mode === 'rotation_based') {
          setRelatedPlan({ id: data.id, name: data.name })
        }
        setLoadingRelatedPlan(false)
      }
    }

    fetchRelatedPlan()
  }, [plan.id, plan.type, plan.base_plan_id, plan.year_plan_mode, isRotationYearPlan, isHelpingPlanOfRotationYear, supabase])

  const handleSaveDate = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('plans')
        .update({ date_started: newStartDate })
        .eq('id', plan.id)

      if (error) throw error

      setIsEditingDate(false)
      router.refresh()
    } catch (error) {
      console.error('Error updating start date:', error)
      alert('Failed to update start date')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setNewStartDate(plan.date_started)
    setIsEditingDate(false)
  }

  const handleSwapPlan = () => {
    if (relatedPlan) {
      router.push(`/plans/${relatedPlan.id}`)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
            
            {/* Swap Button for Rotation-Based Year Plans */}
            {(isRotationYearPlan || isHelpingPlanOfRotationYear) && relatedPlan && (
              <button
                onClick={handleSwapPlan}
                disabled={loadingRelatedPlan}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
                title={`Switch to ${relatedPlan.name}`}
              >
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" 
                  />
                </svg>
                {isRotationYearPlan ? 'Full turnus' : 'Grunnturnus'}
              </button>
            )}
          </div>
          
          {/* Plan Metadata */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Varigheit:</span>
              <span className="font-medium text-gray-900">
                {plan.duration_weeks} {plan.duration_weeks === 1 ? 'veke' : 'veker'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium text-gray-900 capitalize">
                {plan.type === 'main' && 'Grunnturnus'}
                {plan.type === 'year' && 'Årsturnus'}
                {plan.type === 'helping' && 'Hjelpeturnus'}
              </span>
              <div className="flex items-center gap-2">
              <span className="text-gray-600">Tariffavtale:</span>
              <span className="font-medium text-gray-900 capitalize">
                {plan.tariffavtale === 'ks' && 'KS'}
                {plan.tariffavtale === 'staten' && 'Staten'}
                {plan.tariffavtale === 'oslo' && 'Oslo Kommune'}
                {plan.tariffavtale === 'aml' && 'Ingen (AML)'}
              </span>
            </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Start Dato:</span>
              {isEditingDate ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                  />
                  <button
                    onClick={handleSaveDate}
                    disabled={isSaving}
                    className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-2 py-1 border border-gray-300 text-gray-700 rounded text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {new Date(plan.date_started).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                  <button
                    onClick={() => setIsEditingDate(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Endre
                  </button>
                </div>
              )}
            </div>
            {basePlanName && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Basert på:</span>
                <span className="font-medium text-gray-900">{basePlanName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Right Side */}
        <div className="flex gap-2 ml-6">
          <Link
            href={`/plans/${plan.id}`}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              activePage === 'rotation'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 6h16M4 10h16M4 14h16M4 18h16" 
              />
            </svg>
            Turnus
          </Link>

          <Link
            href={`/plans/${plan.id}/calendar`}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              activePage === 'calendar'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
              />
            </svg>
            Kalendar
          </Link>

          <Link
            href={`/plans/${plan.id}/law-checks`}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              activePage === 'lawChecks'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            Lovsjekk
          </Link>
        </div>
      </div>

      {plan.description && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Beskrivelse</div>
          <div className="text-gray-900">{plan.description}</div>
        </div>
      )}
    </div>
  )
}