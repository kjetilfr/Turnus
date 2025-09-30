// src/components/plan/CreatePlanForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlanType } from '@/types/plan'

interface MainPlan {
  id: string
  name: string
}

interface CreatePlanFormProps {
  mainPlans: MainPlan[]
}

export default function CreatePlanForm({ mainPlans }: CreatePlanFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [durationWeeks, setDurationWeeks] = useState(1)
  const [type, setType] = useState<PlanType>('main')
  const [basePlanId, setBasePlanId] = useState('')
  const [dateStarted, setDateStarted] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Validate helping plan has base plan
      if (type === 'helping' && !basePlanId) {
        throw new Error('Helping plans must have a base plan selected')
      }

      const planData: any = {
        user_id: user.id,
        name,
        description: description || null,
        duration_weeks: durationWeeks,
        type,
        date_started: dateStarted,
      }

      // Only add base_plan_id for helping plans
      if (type === 'helping') {
        planData.base_plan_id = basePlanId
      }

      const { error: insertError } = await supabase
        .from('plans')
        .insert([planData])

      if (insertError) throw insertError

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Plan Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Plan Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            placeholder="e.g., Emergency Department Schedule"
          />
        </div>

        {/* Date Started */}
        <div>
          <label htmlFor="dateStarted" className="block text-sm font-medium text-gray-700 mb-2">
            Start Date *
          </label>
          <input
            id="dateStarted"
            type="date"
            value={dateStarted}
            onChange={(e) => setDateStarted(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
          />
          <p className="mt-2 text-sm text-gray-600">
            The date when this rotation plan begins
          </p>
        </div>

        {/* Plan Type - CARD SELECTION */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Plan Type *
          </label>
          <div className="grid grid-cols-3 gap-4">
            {/* Main Plan Card */}
            <button
              type="button"
              onClick={() => {
                setType('main')
                setBasePlanId('')
              }}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                ${type === 'main' 
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }
              `}
            >
              <div className="font-semibold text-gray-900 mb-1">Main Plan</div>
              <div className="text-xs text-gray-600">
                Primary scheduling plan
              </div>
            </button>

            {/* Helping Plan Card */}
            <button
              type="button"
              onClick={() => setType('helping')}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                ${type === 'helping' 
                  ? 'border-green-500 bg-green-50 ring-2 ring-green-200' 
                  : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
                }
              `}
            >
              <div className="font-semibold text-gray-900 mb-1">Helping Plan</div>
              <div className="text-xs text-gray-600">
                Supplementary plan
              </div>
            </button>

            {/* Year Plan Card (Disabled) */}
            <button
              type="button"
              disabled
              className="p-4 border-2 border-gray-200 rounded-lg text-left opacity-50 cursor-not-allowed bg-gray-50"
            >
              <div className="font-semibold text-gray-500 mb-1">Year Plan</div>
              <div className="text-xs text-gray-400">
                Coming soon
              </div>
            </button>
          </div>
        </div>

        {/* Base Plan (only for helping plans) */}
        {type === 'helping' && (
          <div>
            <label htmlFor="basePlan" className="block text-sm font-medium text-gray-700 mb-2">
              Base Plan *
            </label>
            {mainPlans.length > 0 ? (
              <select
                id="basePlan"
                value={basePlanId}
                onChange={(e) => setBasePlanId(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              >
                <option value="">Select a main plan</option>
                {mainPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
                You need to create a main plan first before you can create a helping plan.
              </div>
            )}
          </div>
        )}

        {/* Duration */}
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
            Duration (weeks) *
          </label>
          <input
            id="duration"
            type="number"
            min="1"
            max="52"
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(parseInt(e.target.value))}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
          />
          <p className="mt-2 text-sm text-gray-600">
            How many weeks does this plan cover?
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            placeholder="Add any notes or details about this plan..."
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || (type === 'helping' && mainPlans.length === 0)}
            className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Plan'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}