// src/components/plan/PlanDetails.tsx
'use client'

import { Plan } from '@/types/plan'
import Link from 'next/link'
import { useState } from 'react'
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{plan.name}</h2>
          
          {/* Plan Metadata */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium text-gray-900">
                {plan.duration_weeks} {plan.duration_weeks === 1 ? 'week' : 'weeks'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium text-gray-900 capitalize">{plan.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Start Date:</span>
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
                    Change
                  </button>
                </div>
              )}
            </div>
            {basePlanName && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Based On:</span>
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
            Rotation
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
            Calendar
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
            Law Checks
          </Link>
        </div>
      </div>

      {plan.description && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Description</div>
          <div className="text-gray-900">{plan.description}</div>
        </div>
      )}
    </div>
  )
}