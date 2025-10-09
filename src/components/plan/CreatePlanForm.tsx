// src/components/plan/CreatePlanForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlanType, Tariffavtale, YearPlanMode } from '@/types/plan'

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
  const [workPercent, setWorkPercent] = useState(100)
  const [tariffavtale, setTariffavtale] = useState<Tariffavtale>('ks')
  const [yearPlanMode, setYearPlanMode] = useState<YearPlanMode>('rotation_based')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required number fields
    if (isNaN(durationWeeks) || durationWeeks < 1) {
      setError('Please enter a valid duration')
      return
    }
    
    if (isNaN(workPercent) || workPercent < 0 || workPercent > 100) {
      setError('Please enter a valid work percentage (0-100)')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Validate helping plan has base plan
      if (type === 'helping' && !basePlanId) {
        throw new Error('Helping plans must have a base plan selected')
      }

      // Validate work percent
      if (workPercent < 0 || workPercent > 100) {
        throw new Error('Work percentage must be between 0 and 100')
      }

      // For rotation_based year plans, modify the name and create helping plan
      if (type === 'year' && yearPlanMode === 'rotation_based') {
        // Create the rotation-based year plan with modified name
        const rotationYearPlanName = `${name} (${durationWeeks} weeks)`
        
        const rotationYearPlanData = {
          user_id: user.id,
          name: rotationYearPlanName,
          description: description || null,
          duration_weeks: durationWeeks,
          type: 'year' as PlanType,
          date_started: dateStarted,
          work_percent: workPercent,
          tariffavtale,
          year_plan_mode: yearPlanMode,
        }

        const { data: rotationYearPlan, error: rotationYearError } = await supabase
          .from('plans')
          .insert([rotationYearPlanData])
          .select()
          .single()

        if (rotationYearError) throw rotationYearError
        if (!rotationYearPlan) throw new Error('Failed to create rotation year plan')

        // Create the helping plan (52 weeks) with the rotation year plan as base
        const helpingPlanName = `${name} (52 weeks)`
        
        const helpingPlanData = {
          user_id: user.id,
          name: helpingPlanName,
          description: description ? `${description} - Full year schedule` : 'Full year schedule',
          duration_weeks: 52,
          type: 'year' as PlanType,
          base_plan_id: rotationYearPlan.id,
          date_started: dateStarted,
          work_percent: workPercent,
          tariffavtale,
        }

        const { error: helpingPlanError } = await supabase
          .from('plans')
          .insert([helpingPlanData])

        if (helpingPlanError) throw helpingPlanError

        // Redirect to the rotation year plan (the base plan)
        router.push(`/plans/${rotationYearPlan.id}`)
        router.refresh()
      } else {
        // Standard plan creation for non-rotation-based year plans and other plan types
        const planData = {
          user_id: user.id,
          name,
          description: description || null,
          duration_weeks: durationWeeks,
          type,
          date_started: dateStarted,
          work_percent: workPercent,
          tariffavtale,
          ...(type === 'helping' && { base_plan_id: basePlanId }),
          ...(type === 'year' && { year_plan_mode: yearPlanMode }),
        }

        const { data: createdPlan, error: insertError } = await supabase
          .from('plans')
          .insert([planData])
          .select()
          .single()

        if (insertError) throw insertError

        // Redirect to the created plan or home
        if (createdPlan) {
          router.push(`/plans/${createdPlan.id}`)
        } else {
          router.push('/')
        }
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const expectedWeeklyHours = (35.5 * workPercent / 100).toFixed(1)

  // Calculate what the actual plan names will be for rotation_based year plans
  const rotationYearPlanPreview = type === 'year' && yearPlanMode === 'rotation_based' && name
    ? `${name} (${durationWeeks} weeks)`
    : null
  const helpingPlanPreview = type === 'year' && yearPlanMode === 'rotation_based' && name
    ? `${name} (52 weeks)`
    : null

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
          {rotationYearPlanPreview && (
            <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-xs font-semibold text-purple-900 mb-1">Plans to be created:</p>
              <ul className="text-xs text-purple-800 space-y-1">
                <li>• Rotation plan: <span className="font-semibold">{rotationYearPlanPreview}</span></li>
                <li>• Full year plan: <span className="font-semibold">{helpingPlanPreview}</span></li>
              </ul>
            </div>
          )}
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

            {/* Year Plan Card */}
            <button
              type="button"
              onClick={() => setType('year')}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                ${type === 'year' 
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                }
              `}
            >
              <div className="font-semibold text-gray-900 mb-1">Year Plan</div>
              <div className="text-xs text-gray-600">
                Annual planning
              </div>
            </button>
          </div>
        </div>

        {/* Year Plan Mode (only for year plans) */}
        {type === 'year' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year Plan Mode *
            </label>
            <div className="space-y-2">
              <label className={`
                flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all
                ${yearPlanMode === 'rotation_based' 
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                }
              `}>
                <input
                  type="radio"
                  name="yearPlanMode"
                  value="rotation_based"
                  checked={yearPlanMode === 'rotation_based'}
                  onChange={(e) => setYearPlanMode(e.target.value as YearPlanMode)}
                  className="mt-0.5 w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Rotation Based</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Creates rotation plan ({durationWeeks} weeks) + full year helping plan (52 weeks)
                  </div>
                </div>
              </label>

              <label className={`
                flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all
                ${yearPlanMode === 'strict_year' 
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                }
              `}>
                <input
                  type="radio"
                  name="yearPlanMode"
                  value="strict_year"
                  checked={yearPlanMode === 'strict_year'}
                  onChange={(e) => setYearPlanMode(e.target.value as YearPlanMode)}
                  className="mt-0.5 w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Strict Year</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Creates only year schedule view (no rotation grid)
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

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
            value={isNaN(durationWeeks) ? '' : durationWeeks}
            onChange={(e) => {
              const val = e.target.value === '' ? NaN : parseInt(e.target.value)
              setDurationWeeks(val)
            }}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
          />
          <p className="mt-2 text-sm text-gray-600">
            {type === 'year' && yearPlanMode === 'rotation_based' 
              ? `Rotation cycle length (full year plan will be 52 weeks)`
              : `How many weeks does this plan cover?`
            }
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
              value={isNaN(workPercent) ? '' : workPercent}
              onChange={(e) => {
                const val = e.target.value === '' ? NaN : parseFloat(e.target.value)
                setWorkPercent(val)
              }}
              required
              className="w-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            />
            <span className="text-sm text-gray-700">%</span>
            <div className="flex-1 text-sm text-gray-600">
              Expected weekly hours: <span className="font-semibold text-gray-900">{isNaN(workPercent) ? '-' : (35.5 * workPercent / 100).toFixed(1)}h</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            The work percentage for this position (100% = 35.5 hours/week)
          </p>
        </div>

        {/* Tariffavtale Selection - COMPACT */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tariffavtale *
          </label>
          <div className="grid grid-cols-4 gap-2">
            <label className={`
              flex items-center justify-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all text-sm
              ${tariffavtale === 'ks' 
                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
              }
            `}>
              <input
                type="radio"
                name="tariffavtale"
                value="ks"
                checked={tariffavtale === 'ks'}
                onChange={(e) => setTariffavtale(e.target.value as Tariffavtale)}
                className="w-3 h-3 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="font-medium text-gray-900">KS</span>
            </label>

            <label className={`
              flex items-center justify-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all text-sm
              ${tariffavtale === 'staten' 
                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
              }
            `}>
              <input
                type="radio"
                name="tariffavtale"
                value="staten"
                checked={tariffavtale === 'staten'}
                onChange={(e) => setTariffavtale(e.target.value as Tariffavtale)}
                className="w-3 h-3 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="font-medium text-gray-900">Staten</span>
            </label>

            <label className={`
              flex items-center justify-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all text-sm
              ${tariffavtale === 'oslo' 
                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
              }
            `}>
              <input
                type="radio"
                name="tariffavtale"
                value="oslo"
                checked={tariffavtale === 'oslo'}
                onChange={(e) => setTariffavtale(e.target.value as Tariffavtale)}
                className="w-3 h-3 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="font-medium text-gray-900">Oslo</span>
            </label>

            <label className={`
              flex items-center justify-center gap-2 p-2 border-2 rounded-lg cursor-pointer transition-all text-sm
              ${tariffavtale === 'aml'
                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
              }
            `}>
              <input
                type="radio"
                name="tariffavtale"
                value="aml"
                checked={tariffavtale === 'aml'}
                onChange={(e) => setTariffavtale(e.target.value as Tariffavtale)}
                className="w-3 h-3 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="font-medium text-gray-900">Ingen</span>
            </label>
          </div>
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
            {loading ? 'Creating...' : 
             type === 'year' && yearPlanMode === 'rotation_based' ? 'Create Plans' : 
             'Create Plan'}
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