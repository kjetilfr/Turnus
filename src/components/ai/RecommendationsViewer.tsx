// src/components/ai/RecommendationsViewer.tsx
'use client'

interface Recommendation {
  issue: string
  severity: 'high' | 'medium' | 'low'
  suggestion: string
  affected_dates: string[]
  proposed_changes: Array<{
    date: string
    current_shift: string
    proposed_shift: string
    reason: string
  }>
}

export default function RecommendationsViewer({ 
  recommendations 
}: { 
  recommendations: Recommendation[] 
}) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">AI-genererte forbetringar</h2>

      {recommendations.map((rec, idx) => (
        <div key={idx} className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-600">
          {/* Severity badge */}
          <div className="flex items-center justify-between mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getSeverityColor(rec.severity)}`}>
              {rec.severity === 'high' ? 'Høg prioritet' : 
               rec.severity === 'medium' ? 'Medium prioritet' : 
               'Låg prioritet'}
            </span>
          </div>

          {/* Issue */}
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {rec.issue}
          </h3>

          {/* Suggestion */}
          <p className="text-gray-700 mb-4">
            {rec.suggestion}
          </p>

          {/* Proposed changes */}
          {rec.proposed_changes.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Foreslåtte endringar:</h4>
              <div className="space-y-2">
                {rec.proposed_changes.map((change, changeIdx) => (
                  <div key={changeIdx} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">{change.date}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-mono text-sm">
                          {change.current_shift}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-mono text-sm">
                          {change.proposed_shift}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm text-gray-600">{change.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}