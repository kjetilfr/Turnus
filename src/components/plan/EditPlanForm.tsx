// src/components/plan/EditPlanForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plan, PlanType, Tariffavtale, YearPlanMode } from '@/types/plan'

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
  const [tariffavtale, setTariffavtale] = useState<Tariffavtale>(plan.tariffavtale || 'ks')
  const [loading, setLoading] = useState(false)
  const [yearPlanMode, setYearPlanMode] = useState<YearPlanMode>(plan.year_plan_mode || 'rotation_based')
  const [error, setError] = useState<string | null>(null)
  const [f3Days, setF3Days] = useState(plan.f3_days || 0)
  const [f5Days, setF5Days] = useState(plan.f5_days || 0)

  useEffect(() => {
    if (type === 'year' && yearPlanMode === 'strict_year') {
      setDurationWeeks(52)
    }
  }, [type, yearPlanMode])

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
        tariffavtale,
        base_plan_id: type === 'helping' ? basePlanId : null,
        year_plan_mode: type === 'year' ? yearPlanMode : null,
        f3_days: type === 'year' && yearPlanMode === 'strict_year' ? f3Days : null,
        f5_days: type === 'year' && yearPlanMode === 'strict_year' ? f5Days : null
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
            Turnus namn *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            placeholder="Påsketurnus 2025"
          />
        </div>

        {/* Date Started */}
        <div>
          <label htmlFor="dateStarted" className="block text-sm font-medium text-gray-700 mb-2">
            Start Dato *
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
            Datoen turnusen skal starte
          </p>
        </div>

        {/* Plan Type - CARD SELECTION */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Turnus type *
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
              <div className="font-semibold text-gray-900 mb-1">Grunnturnus</div>
              <div className="text-xs text-gray-600">
                Roterande Hovudturnus/Grunnturnus
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
              <div className="font-semibold text-gray-900 mb-1">Hjelpeturnus</div>
              <div className="text-xs text-gray-600">
                Hjelpeturnus for jul, påske og sommar m.m.
              </div>
            </button>

            {/* Year Plan Card - REPLACE the disabled button with this: */}
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
              <div className="font-semibold text-gray-900 mb-1">Årsturnus</div>
              <div className="text-xs text-gray-600">
                Velg mellom to typar årsturnus
              </div>
            </button>
          </div>
        </div>

        {/* Year Plan Mode (only for year plans) */}
        {type === 'year' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type årsturnus *
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
                  <div className="font-semibold text-gray-900">Rotasjonsbasert årsturnus</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Lager ein turnus på ({durationWeeks} veker) så rullerer du denne ut i 52 veker og justerer timetalet (1846t). F3 og F5 blir kalkulert basert på grunnturnus
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
                  <div className="font-semibold text-gray-900">Årsturnus</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Årsturnus med forhandsbestemt mengde F3 og F5 dagar. Baserar seg ikkje på grunnturnus.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* F3 and F5 input for strict_year_plans */}
        {type === 'year' && yearPlanMode === 'strict_year' && (
          <>
            <div>
              <label htmlFor="f3Days" className="block text-sm font-medium text-gray-700 mb-2">
                F3 Dagar
              </label>
              <input
                id="f3Days"
                type="number"
                min="0"
                max="365"
                value={isNaN(f3Days) ? '' : f3Days}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value)
                  setF3Days(val)
                }}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
              <p className="mt-2 text-sm text-gray-600">
                Tal på forhandsbestemte F3 dagar
              </p>
            </div>

            <div>
              <label htmlFor="f5Days" className="block text-sm font-medium text-gray-700 mb-2">
                F5 Dagar
              </label>
              <input
                id="f5Days"
                type="number"
                min="0"
                max="365"
                value={isNaN(f5Days) ? '' : f5Days}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value)
                  setF5Days(val)
                }}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
              <p className="mt-2 text-sm text-gray-600">
                Tal på forhandsbestemte F5 dagar
              </p>
            </div>
          </>
        )}

        {/* Base Plan (only for helping plans) */}
        {type === 'helping' && (
          <div>
            <label htmlFor="basePlan" className="block text-sm font-medium text-gray-700 mb-2">
              Grunnturnus/Hovudturnus *
            </label>
            {mainPlans.length > 0 ? (
              <select
                id="basePlan"
                value={basePlanId}
                onChange={(e) => setBasePlanId(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              >
                <option value="">Velg grunnturnus</option>
                {mainPlans.map((mainPlan) => (
                  <option key={mainPlan.id} value={mainPlan.id}>
                    {mainPlan.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
                Alle hjelpeturnusar er basert på ein grunnturnus. Lag grunnturnus før du lagar hjelpeturnus.
              </div>
            )}
          </div>
        )}

        {/* Duration */}
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
            Varigheit (veker) *
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
            disabled={type === 'year' && yearPlanMode === 'strict_year'}  // ADD THIS
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"  // ADD disabled styles
          />
        </div>

        {/* Work Percentage */}
        <div>
          <label htmlFor="workPercent" className="block text-sm font-medium text-gray-700 mb-2">
            Stillingsprosent *
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
              Forventa timetal per veke: <span className="font-semibold text-gray-900">{isNaN(workPercent) ? '-' : (35.5 * workPercent / 100).toFixed(1)}t</span>
            </div>
          </div>
        </div>

        {/* NEW: Tariffavtale Selection - COMPACT */}
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
              ${tariffavtale === 'aml'  // Changed from 'ingen'
                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
              }
            `}>
              <input
                type="radio"
                name="tariffavtale"
                value="aml"  // Changed from 'ingen'
                checked={tariffavtale === 'aml'}  // Changed from 'ingen'
                onChange={(e) => setTariffavtale(e.target.value as Tariffavtale)}
                className="w-3 h-3 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="font-medium text-gray-900">Ingen</span>  {/* Changed from 'Ingen' */}
            </label>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Beskrivelse
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            placeholder="(Valgfritt) Utdjuping av planen"
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
              {loading ? 'Lagrar...' : 'Lagre endringar'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Avbryt
            </button>
          </div>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="w-full px-6 py-3 border-2 border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Slettar...' : 'Slett turnus'}
          </button>
        </div>
      </form>
    </div>
  )
}