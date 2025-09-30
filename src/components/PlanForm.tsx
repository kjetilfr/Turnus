// src/components/CreatePlanForm.tsx
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
      }

      // Only add base_plan_id for helping plans
      if (type === 'helping') {
        planData.base_plan_id = basePlanId
      }

      const { error: insertError } = await supabase
        .from('plans')
        .insert([planData])

      if (insertError) throw insertError

      router.push('/dashboard')
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="e.g., Emergency Department Schedule"
          />
        </div>

        {/* Plan Type */}
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
            Plan Type *
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as PlanType)
              if (e.target.value !== 'helping') {
                setBasePlanId('')
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="main">Main Plan</option>
            <option value="helping">Helping Plan</option>
            <option value="year" disabled>Year Plan (Coming Soon)</option>
          </select>
          <p className="mt-2 text-sm text-gray-600">
            {type === 'main' && 'A primary scheduling plan that can be used as a base for helping plans'}
            {type === 'helping' && 'A supplementary plan based on an existing main plan'}
            {type === 'year' && 'Annual planning (coming soon)'}
          </p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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