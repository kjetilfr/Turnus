// src/components/plan/EditPlanForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plan, PlanType } from '@/types/plan'

interface MainPlan {
  id: string
  name: string
}

interface EditPlanFormProps {
  plan: Plan
  mainPlans: MainPlan[]
}

export default function EditPlanForm({ plan, mainPlans }: EditPlanFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [name, setName] = useState(plan.name)
  const [description, setDescription] = useState(plan.description || '')
  const [durationWeeks, setDurationWeeks] = useState(plan.duration_weeks)
  const [type, setType] = useState<PlanType>(plan.type)
  const [basePlanId, setBasePlanId] = useState(plan.base_plan_id || '')
  const [dateStarted, setDateStarted] = useState(plan.date_started)
  const [workPercent, setWorkPercent] = useState(plan.work_percent || 100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate helping plan has base plan
      if (type === 'helping' && !basePlanId) {
        throw new Error('Helping plans must have a base plan selected')
      }

      // Validate work percent
      if (workPercent < 0 || workPercent > 100) {
        throw new Error('Work percentage must be between 0 and 100')
      }

      const updateData = {
        name,
        description: description || null,
        duration_weeks: durationWeeks,
        type,
        date_started: dateStarted,
        work_percent: workPercent,
        base_plan_id: type === 'helping' ? basePlanId : null,
      }

      const { error: updateError } = await supabase
        .from('plans')
        .update(updateData)
        .eq('id', plan.id)

      if (updateError) throw updateError

      router.push(`/plans/${plan.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('plans')
        .delete()
        .eq('id', plan.id)

      if (deleteError) throw deleteError

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  const expectedWeeklyHours = (35.5 * workPercent / 100).toFixed(1)

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
                {mainPlans.map((mainPlan) => (
                  <option key={mainPlan.id} value={mainPlan.id}>
                    {mainPlan.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
                You need to have a main plan to use as a base.
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

        {/* Work Percentage */}
        <div>
          <label htmlFor="workPercent" className="block text-sm font-medium text-gray-700 mb-2">
            Work Percentage *
          </label>
          <div className="flex items-center gap-4">
            <input
              id="workPercent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={workPercent}
              onChange={(e) => setWorkPercent(parseFloat(e.target.value))}
              required
              className="w-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            />
            <span className="text-sm text-gray-700">%</span>
            <div className="flex-1 text-sm text-gray-600">
              Expected weekly hours: <span className="font-semibold text-gray-900">{expectedWeeklyHours}h</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            The work percentage for this position (100% = 35.5 hours/week)
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
        <div className="flex flex-col gap-4 pt-4 border-t border-gray-200">
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || (type === 'helping' && mainPlans.length === 0)}
              className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="w-full px-6 py-3 border-2 border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting...' : 'Delete Plan'}
          </button>
        </div>
      </form>
    </div>
  )
}