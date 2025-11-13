// src/components/rotation/AIImprovementsManager.tsx
'use client'

import { useState } from 'react'
import { Shift } from '@/types/shift'
import { Rotation } from '@/types/rotation'
import { Sparkles, AlertCircle } from 'lucide-react'
import RotationComparisonGrid from './RotationComparisonGrid'
import { useRouter } from 'next/navigation'

interface ProposedChange {
  week_index: number
  day_of_week: number
  current_shift_id: string | null
  proposed_shift_id: string | null
  reason: string
}

interface AIResponse {
  success: boolean
  ai_model: string
  data: {
    summary: string
    changes_count: number
    improvements: string[]
    proposed_changes: ProposedChange[]
  }
}

interface AIImprovementsManagerProps {
  planId: string
  rotations: Rotation[]
  shifts: Shift[]
  durationWeeks: number
  planDetails: {
    name: string
    duration_weeks: number
    type: string
    work_percent?: number
    tariffavtale?: string
    date_started?: string
  }
  rules?: {
    rest_period_f1?: number
    rest_between_shifts?: number
    max_shift_length?: number
  }
}

export default function AIImprovementsManager({
  planId,
  rotations,
  shifts,
  durationWeeks,
  planDetails,
  rules
}: AIImprovementsManagerProps) {
  const router = useRouter()
  const [userPrompt, setUserPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [selectedModel, setSelectedModel] = useState<'auto' | 'claude' | 'gpt4o' | 'gemini-flash' | 'gemini-pro'>('auto')

  const handleGenerateImprovements = async () => {
    if (!userPrompt.trim()) {
      setError('Vennligst skriv inn kva du vil forbetre')
      return
    }

    setIsLoading(true)
    setError(null)
    setAiResponse(null)

    try {
      const response = await fetch('/api/ai/improve-rotation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          userPrompt,
          rotations,
          shifts,
          planDetails,
          rules,
          aiModel: selectedModel
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Kunne ikkje generere forbetringar')
      }

      if (data.data.proposed_changes.length === 0) {
        setError('AI fann ingen endringar som trengst. Turnusen ser allereie bra ut!')
        return
      }

      setAiResponse(data)
    } catch (err) {
      console.error('Error generating improvements:', err)
      setError(err instanceof Error ? err.message : 'Noko gjekk galt')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyChanges = async () => {
    if (!aiResponse) return

    setIsApplying(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/apply-improvements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          changes: aiResponse.data.proposed_changes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Kunne ikkje bruke endringar')
      }

      // Success! Refresh the page to show updated rotation
      router.refresh()
      setAiResponse(null)
      setUserPrompt('')
      
      // Show success message
      alert(`✅ Brukte ${data.applied} av ${data.total} endringar!`)
    } catch (err) {
      console.error('Error applying changes:', err)
      setError(err instanceof Error ? err.message : 'Kunne ikkje bruke endringar')
      setIsApplying(false)
    }
  }

  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Sparkles className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              AI Turnusforbetring
            </h3>
            <p className="text-sm text-gray-600">
              Be AI om å analysere og forbetre turnusen din
            </p>
          </div>
        </div>

        {/* Model Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vel AI-modell
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as typeof selectedModel)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          >
            <option value="auto">Automatisk (GPT-4o)</option>
            <option value="gpt4o">GPT-4o (OpenAI)</option>
            <option value="claude">Claude Sonnet 4 (Anthropic)</option>
            <option value="gemini-flash">Gemini 2.0 Flash (Google)</option>
            <option value="gemini-pro">Gemini 2.5 Pro (Google)</option>
          </select>
        </div>

        {/* Input Area */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kva vil du forbetre?
          </label>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Eksempel: 'Sørg for at det alltid er langvakt på fredag før arbeidshelg' eller 'Flytt F1 til søndag der det ikkje er arbeidshelg'"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            rows={4}
            disabled={isLoading}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleGenerateImprovements}
          disabled={isLoading || !userPrompt.trim()}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyserer turnusen...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generer forbetringsforslag
            </>
          )}
        </button>

        {/* Info Text */}
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>💡 AI-en vil:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Identifisere tilbakevendande mønster i heile turnusen</li>
            <li>Foreslå endringar som følgjer Arbeidsmiljølova</li>
            <li>Balansere totale arbeidstimar (±2t)</li>
            <li>Respektere F1-plassering og arbeidshelg-struktur</li>
          </ul>
        </div>
      </div>

      {/* Preview Modal */}
      {aiResponse && (
        <RotationComparisonGrid
            currentRotation={rotations}
            proposedChanges={aiResponse.data.proposed_changes}
            shifts={shifts}
            durationWeeks={durationWeeks}
            summary={aiResponse.data.summary}
            improvements={aiResponse.data.improvements}
            onApply={handleApplyChanges}
            onCancel={() => {
            setAiResponse(null)
            setError(null)
            }}
            isApplying={isApplying}
        />
        )}
    </>
  )
}