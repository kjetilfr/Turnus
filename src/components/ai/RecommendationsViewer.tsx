// src/components/ai/RecommendationsViewer.tsx - IMPROVED VERSION
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProposedChange {
  date: string
  current_shift: string
  proposed_shift: string
  reason: string
}

interface Recommendation {
  category: 'legal_violation' | 'health_concern' | 'optimization'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  issue: string
  law_reference?: string
  affected_dates: string[]
  suggestion: string
  proposed_changes: ProposedChange[]
  impact: string
}

interface RecommendationsData {
  overall_score: number
  summary: {
    total_issues: number
    critical_violations: number
    improvements_possible: number
    estimated_impact: string
  }
  recommendations: Recommendation[]
}

interface Props {
  recommendations: RecommendationsData
  planId: string
}

export default function RecommendationsViewer({ recommendations, planId }: Props) {
  const [applying, setApplying] = useState<number | null>(null)
  const [appliedChanges, setAppliedChanges] = useState<Set<number>>(new Set())
  const router = useRouter()

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'legal_violation':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'health_concern':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        )
      case 'optimization':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return 'Kritisk'
      case 'high': return 'Høg prioritet'
      case 'medium': return 'Medium prioritet'
      case 'low': return 'Låg prioritet'
      default: return severity
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'legal_violation': return '⚖️ Lovbrot'
      case 'health_concern': return '❤️ Helse & velvære'
      case 'optimization': return '⚡ Optimalisering'
      default: return category
    }
  }

  const handleApplyChanges = async (recIndex: number) => {
    try {
      setApplying(recIndex)

      const rec = recommendations.recommendations[recIndex]
      
      // Call API to apply the changes
      const response = await fetch('/api/ai/apply-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          changes: rec.proposed_changes,
        }),
      })

      if (!response.ok) {
        throw new Error('Kunne ikkje bruke endringane')
      }

      // Mark as applied
      setAppliedChanges(prev => new Set(prev).add(recIndex))

      // Refresh the page after a short delay
      setTimeout(() => {
        router.refresh()
      }, 1000)

    } catch (error) {
      console.error('Apply error:', error)
      alert('Kunne ikkje bruke endringane. Prøv igjen.')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 border-2 border-red-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              AI-analyse av turnusplan
            </h2>
            <p className="text-gray-700">
              {recommendations.summary.estimated_impact}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-red-600">
              {recommendations.overall_score.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">av 10</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {recommendations.summary.total_issues}
            </div>
            <div className="text-sm text-gray-600">Totalt problem</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {recommendations.summary.critical_violations}
            </div>
            <div className="text-sm text-gray-600">Kritiske brot</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {recommendations.summary.improvements_possible}
            </div>
            <div className="text-sm text-gray-600">Forbetringar</div>
          </div>
        </div>
      </div>

      {/* Recommendations list */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900">
          Detaljerte anbefallingar
        </h3>

        {recommendations.recommendations.map((rec, idx) => {
          const isApplied = appliedChanges.has(idx)
          const isApplying = applying === idx

          return (
            <div
              key={idx}
              className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${
                rec.severity === 'critical' ? 'border-red-600' :
                rec.severity === 'high' ? 'border-orange-500' :
                rec.severity === 'medium' ? 'border-yellow-500' :
                'border-blue-500'
              } ${isApplied ? 'opacity-60' : ''}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    rec.severity === 'critical' ? 'bg-red-100 text-red-600' :
                    rec.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                    rec.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {getCategoryIcon(rec.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-600">
                        {getCategoryLabel(rec.category)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getSeverityColor(rec.severity)}`}>
                        {getSeverityLabel(rec.severity)}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">
                      {rec.title}
                    </h4>
                  </div>
                </div>
                {isApplied && (
                  <span className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
                    ✓ Brukt
                  </span>
                )}
              </div>

              {/* Issue description */}
              <div className="mb-4">
                <p className="text-gray-700">{rec.issue}</p>
                {rec.law_reference && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Lovparagraf:</strong> {rec.law_reference}
                  </p>
                )}
              </div>

              {/* Suggestion */}
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <h5 className="font-semibold text-blue-900 mb-2">💡 Forslag:</h5>
                <p className="text-blue-800">{rec.suggestion}</p>
              </div>

              {/* Proposed changes */}
              {rec.proposed_changes.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h5 className="font-semibold text-gray-900 mb-3">
                    Foreslåtte endringar ({rec.proposed_changes.length}):
                  </h5>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {rec.proposed_changes.map((change, changeIdx) => (
                      <div
                        key={changeIdx}
                        className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600 font-medium min-w-[100px]">
                            {change.date}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-mono text-sm font-semibold">
                              {change.current_shift}
                            </span>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-mono text-sm font-semibold">
                              {change.proposed_shift}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm text-gray-600 ml-4">
                          {change.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Impact */}
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-gray-700">
                  <strong>Effekt:</strong> {rec.impact}
                </span>
              </div>

              {/* Apply button */}
              {rec.proposed_changes.length > 0 && !isApplied && (
                <button
                  onClick={() => handleApplyChanges(idx)}
                  disabled={isApplying}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isApplying ? 'Brukar endringar...' : 'Bruk desse endringane'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}