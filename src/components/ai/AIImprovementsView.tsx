// src/components/ai/AIImprovementsView.tsx
'use client'

import { useState } from 'react'
import { Plan } from '@/types/plan'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { useRouter } from 'next/navigation'
import RotationVisualComparison from './RotationVisualComparison'

interface AIImprovementsViewProps {
  plan: Plan
  rotations: Rotation[]
  shifts: Shift[]
}

interface ProposedChange {
  week_index: number
  day_of_week: number
  current_shift_id: string | null
  proposed_shift_id: string | null
  reason: string
}

interface AIResponse {
  summary: string
  changes_count: number
  improvements: string[]
  proposed_changes: ProposedChange[]
  new_rotation: Rotation[]
  ai_model?: string
}

type AIModel = 'auto' | 'claude' | 'gpt4o' | 'gemini-flash' | 'gemini-pro'

export default function AIImprovementsView({ plan, rotations, shifts }: AIImprovementsViewProps) {
  const router = useRouter()
  const [userPrompt, setUserPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null)
  const [applying, setApplying] = useState(false)
  const [selectedModel, setSelectedModel] = useState<AIModel>('auto')
  
  // Rule inputs with defaults from AML
  const [restPeriodF1, setRestPeriodF1] = useState('35') // hours - AML § 10-8 (5)
  const [restBetweenShifts, setRestBetweenShifts] = useState('11') // hours - AML § 10-8 (1)
  const [maxShiftLength, setMaxShiftLength] = useState('13') // hours - AML § 10-4 (2)

  const handleGenerateSuggestions = async () => {
    if (!userPrompt.trim()) {
      setError('Venlegast skriv inn kva du vil forbetre')
      return
    }

    setLoading(true)
    setError(null)
    setAiResponse(null)

    try {
      const response = await fetch('/api/ai/improve-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          userPrompt,
          rotations,
          shifts,
          aiModel: selectedModel,
          planDetails: {
            name: plan.name,
            duration_weeks: plan.duration_weeks,
            type: plan.type,
            work_percent: plan.work_percent,
            tariffavtale: plan.tariffavtale,
            date_started: plan.date_started
          },
          rules: {
            rest_period_f1: parseInt(restPeriodF1),
            rest_between_shifts: parseInt(restBetweenShifts),
            max_shift_length: parseInt(maxShiftLength)
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunne ikkje generere forslag')
      }

      // Add ai_model to response data
      setAiResponse({
        ...data.data,
        ai_model: data.ai_model
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjend feil')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyChanges = async () => {
    if (!aiResponse || aiResponse.proposed_changes.length === 0) return

    if (!confirm(`Er du sikker på at du vil bruke ${aiResponse.proposed_changes.length} endringar?`)) {
      return
    }

    setApplying(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/apply-improvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          changes: aiResponse.proposed_changes
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunne ikkje bruke endringar')
      }

      // Refresh the page to show updated rotation
      router.refresh()
      setAiResponse(null)
      setUserPrompt('')
      alert(`✅ Brukte ${data.applied} av ${data.total} endringar`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjend feil ved å bruke endringar')
    } finally {
      setApplying(false)
    }
  }

  const getShiftName = (shiftId: string | null) => {
    if (!shiftId) return 'Ledig'
    const shift = shifts.find(s => s.id === shiftId)
    return shift?.name || 'Ukjend'
  }

  const getDayName = (dayIndex: number) => {
    const days = ['Måndag', 'Tysdag', 'Onsdag', 'Torsdag', 'Fredag', 'Laurdag', 'Søndag']
    return days[dayIndex]
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">AI-forbetringar</h2>
            <p className="text-sm text-gray-600">Beskriv kva du vil forbetre i turnusen</p>
          </div>
        </div>

        {/* Rules Configuration */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Reglar og krav (AML/Tariffavtale)
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="restPeriodF1" className="block text-xs font-medium text-gray-700 mb-1">
                Kviletid før F1 (timar)
                <span className="ml-1 text-gray-500" title="AML § 10-8 (5)">ℹ️</span>
              </label>
              <input
                id="restPeriodF1"
                type="number"
                min="28"
                max="48"
                value={restPeriodF1}
                onChange={(e) => setRestPeriodF1(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">Standard: 35t (AML § 10-8 (5))</p>
            </div>

            <div>
              <label htmlFor="restBetweenShifts" className="block text-xs font-medium text-gray-700 mb-1">
                Kviletid mellom vakter (timar)
                <span className="ml-1 text-gray-500" title="AML § 10-8 (1)">ℹ️</span>
              </label>
              <input
                id="restBetweenShifts"
                type="number"
                min="8"
                max="24"
                value={restBetweenShifts}
                onChange={(e) => setRestBetweenShifts(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">Standard: 11t (AML § 10-8 (1))</p>
            </div>

            <div>
              <label htmlFor="maxShiftLength" className="block text-xs font-medium text-gray-700 mb-1">
                Maks vaktlengde (timar)
                <span className="ml-1 text-gray-500" title="AML § 10-4 (2)">ℹ️</span>
              </label>
              <input
                id="maxShiftLength"
                type="number"
                min="5"
                step={0.5}
                max="12.5"
                value={maxShiftLength}
                onChange={(e) => setMaxShiftLength(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">Standard: 13t (AML § 10-4 (2))</p>
            </div>
          </div>
        </div>

        {/* AI Model Selection */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Velg AI-modell
          </h3>
          
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => setSelectedModel('auto')}
              className={`p-3 border-2 rounded-lg text-left transition-all ${
                selectedModel === 'auto'
                  ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-200'
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50 bg-white'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">Auto</div>
              <div className="text-xs text-gray-600 mt-1">Vel beste modell</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedModel('claude')}
              className={`p-3 border-2 rounded-lg text-left transition-all ${
                selectedModel === 'claude'
                  ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-200'
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50 bg-white'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">Claude</div>
              <div className="text-xs text-gray-600 mt-1">Sonnet 4</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedModel('gpt4o')}
              className={`p-3 border-2 rounded-lg text-left transition-all ${
                selectedModel === 'gpt4o'
                  ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-200'
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50 bg-white'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">GPT-4o</div>
              <div className="text-xs text-gray-600 mt-1">OpenAI</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedModel('gemini-flash')}
              className={`p-3 border-2 rounded-lg text-left transition-all ${
                selectedModel === 'gemini-flash'
                  ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-200'
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50 bg-white'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">Gemini</div>
              <div className="text-xs text-gray-600 mt-1">2.0 Flash</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedModel('gemini-pro')}
              className={`p-3 border-2 rounded-lg text-left transition-all ${
                selectedModel === 'gemini-pro'
                  ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-200'
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50 bg-white'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">Gemini</div>
              <div className="text-xs text-gray-600 mt-1">2.5 Pro</div>
            </button>
          </div>
          
          <p className="text-xs text-gray-600 mt-2">
            💡 <strong>Auto</strong> vel beste modell basert på oppgåva. <strong>Claude</strong> er best for norsk turnusforståelse.
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-2">Eksempel på forbetringar du kan be om:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>&quot;Ingen vakter på mandagar&quot;</li>
                <li>&quot;Berre vakter som sluttar tidleg på laurdag&quot;</li>
                <li>&quot;Meir kveldsvakter i veke 2 og 3&quot;</li>
                <li>&quot;Jamnare fordeling av nattevakter&quot;</li>
                <li>&quot;Minst 2 fridagar mellom nattevakter&quot;</li>
                <li>&quot;F1 skal ligge til søndag når det ikkje er arbeidshelg&quot;</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="mb-4">
          <label htmlFor="userPrompt" className="block text-sm font-medium text-gray-700 mb-2">
            Kva vil du forbetre?
          </label>
          <textarea
            id="userPrompt"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
            placeholder="Eksempel: Ingen vakter på mandagar, og minst 2 fridagar etter nattevakter..."
            disabled={loading}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerateSuggestions}
          disabled={loading || !userPrompt.trim()}
          className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Genererer forslag...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generer forbetringsforslag
            </>
          )}
        </button>
      </div>

      {/* AI Response Section */}
      {aiResponse && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">AI-forslag klare</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600">{aiResponse.changes_count} endringar foreslått</p>
                    {aiResponse.ai_model && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {aiResponse.ai_model === 'claude' && '🤖 Claude Sonnet 4'}
                        {aiResponse.ai_model === 'gpt4o' && '🤖 GPT-4o'}
                        {aiResponse.ai_model === 'gemini-flash' && '🤖 Gemini 2.0 Flash'}
                        {aiResponse.ai_model === 'gemini-pro' && '🤖 Gemini 2.5 Pro'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleApplyChanges}
                disabled={applying}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {applying ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Bruker...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Bruk endringar
                  </>
                )}
              </button>
            </div>

            {/* Summary */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-purple-900 mb-2">Oppsummering</h4>
              <p className="text-sm text-purple-800">{aiResponse.summary}</p>
            </div>

            {/* Improvements List */}
            {aiResponse.improvements.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Forbetringar:</h4>
                <ul className="space-y-2">
                  {aiResponse.improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-gray-700">{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Changes Table */}
            {aiResponse.proposed_changes.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Detaljerte endringar:</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Veke</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Dag</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Gjeldande</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Forslag</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Grunn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiResponse.proposed_changes.map((change, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">
                            Veke {change.week_index + 1}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">
                            {getDayName(change.day_of_week)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                              {getShiftName(change.current_shift_id)}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              {getShiftName(change.proposed_shift_id)}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">
                            {change.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Visual Comparison */}
          {aiResponse.new_rotation && (
            <RotationVisualComparison
              currentRotation={rotations}
              proposedRotation={aiResponse.new_rotation}
              shifts={shifts}
              durationWeeks={plan.duration_weeks}
            />
          )}
        </>
      )}
    </div>
  )
}