// src/components/plan/CreatePlanForm.tsx
'use client'

import { useState, useEffect } from 'react'
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
  const [dateStarted, setDateStarted] = useState('')
  const [workPercent, setWorkPercent] = useState(100)
  const [tariffavtale, setTariffavtale] = useState<Tariffavtale>('ks')
  const [yearPlanMode, setYearPlanMode] = useState<YearPlanMode>('rotation_based')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [f3Days, setF3Days] = useState(0)
  const [f5Days, setF5Days] = useState(0)

  const isMonday = (dateString: string): boolean => {
    if (!dateString) return true // Don't show warning if no date selected
    const date = new Date(dateString)
    return date.getDay() === 1 // Monday = 1
  }

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
          type: 'helping' as PlanType,  // CHANGE THIS
          base_plan_id: rotationYearPlan.id,
          date_started: dateStarted,
          work_percent: workPercent,
          tariffavtale
        }

        const { error: helpingPlanError } = await supabase
          .from('plans')
          .insert([helpingPlanData])
          .select()
          .single()

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
          ...(type === 'year' && { 
            year_plan_mode: yearPlanMode,
            ...(yearPlanMode === 'strict_year' && {
              f3_days: f3Days,
              f5_days: f5Days
            })
          }),
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

  // Calculate what the actual plan names will be for rotation_based year plans
  type === 'year' && yearPlanMode === 'rotation_based' && name
    ? `${name} (${durationWeeks} weeks)`
    : null
  type === 'year' && yearPlanMode === 'rotation_based' && name
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
          {dateStarted && !isMonday(dateStarted) && (
            <div className="mt-2 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                Advarsel: Du har valgt ein dato som ikkje er mandag. Dette er høgst uvanleg og kan gjere at nokon lovsjekkar ikkje fungerar optimalt.
              </span>
            </div>
          )}
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
                F5 dagar
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
                {mainPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
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
            disabled={type === 'year' && yearPlanMode === 'strict_year'}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"  // ADD disabled styles
          />
          <p className="mt-2 text-sm text-gray-600">
            {type === 'year' && yearPlanMode === 'rotation_based' 
              ? `Over kor mange veker er turnusen?`
              : `Over kor mange veker er turnusen?`
            }
          </p>
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
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || (type === 'helping' && mainPlans.length === 0)}
            className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Lagar turnus...' : 
             type === 'year' && yearPlanMode === 'rotation_based' ? 'Opprett turnus' : 
             'Opprett turnus'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Avbryt
          </button>
        </div>
      </form>
    </div>
  )
}