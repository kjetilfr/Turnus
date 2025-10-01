// src/components/lawChecks/LawChecksView.tsx
'use client'

import { useState } from 'react'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { LAW_CHECKS, getAvailableCategories } from '@/lib/lawChecks'
import { LawCheckResult, LawCheckStatus } from '@/types/lawCheck'
import LawCheckCard from './LawCheckCard'

interface LawChecksViewProps {
  rotations: Rotation[]
  shifts: Shift[]
  plan: Plan
}

export default function LawChecksView({ rotations, shifts, plan }: LawChecksViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('shared')
  const [checkResults, setCheckResults] = useState<Record<string, LawCheckResult>>({})
  const [runningChecks, setRunningChecks] = useState<Record<string, boolean>>({})
  const [checkInputs, setCheckInputs] = useState<Record<string, Record<string, number | string | boolean>>>({})

  const categories = getAvailableCategories()
  const filteredChecks = LAW_CHECKS.filter(check => check.category === selectedCategory)

  const handleRunCheck = (checkId: string) => {
    const check = LAW_CHECKS.find(c => c.id === checkId)
    if (!check) return

    setRunningChecks(prev => ({ ...prev, [checkId]: true }))

    // Small delay to show loading state
    setTimeout(() => {
      const result = check.run({
        rotations,
        shifts,
        plan,
        inputs: checkInputs[checkId] || {}
      })

      setCheckResults(prev => ({ ...prev, [checkId]: result }))
      setRunningChecks(prev => ({ ...prev, [checkId]: false }))
    }, 100)
  }

  const handleRunAllChecks = () => {
    filteredChecks.forEach(check => {
      handleRunCheck(check.id)
    })
  }

  const handleInputChange = (checkId: string, inputId: string, value: number | string | boolean) => {
    setCheckInputs(prev => ({
      ...prev,
      [checkId]: {
        ...(prev[checkId] || {}),
        [inputId]: value
      }
    }))
  }

  // Calculate summary statistics
  const summary = filteredChecks.reduce((acc, check) => {
    const result = checkResults[check.id]
    if (result) {
      acc[result.status]++
    } else {
      acc.not_run++
    }
    return acc
  }, { pass: 0, fail: 0, warning: 0, not_run: 0 } as Record<LawCheckStatus, number>)

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg 
            className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">About Law Compliance Checks:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Shared Tests:</strong> Apply to all plan types</li>
              <li><strong>Main Plan Tests:</strong> Specific to main plans</li>
              <li><strong>Helping Plan Tests:</strong> Specific to helping plans</li>
              <li><strong>Year Plan Tests:</strong> Specific to year plans</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`
                  px-6 py-4 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors
                  ${selectedCategory === category.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                {category.label}
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                  {category.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary Bar */}
        {Object.values(checkResults).length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="flex items-center gap-6 text-sm">
              <div className="font-semibold text-gray-700">Results:</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-700">{summary.pass} Passed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-700">{summary.fail} Failed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-700">{summary.warning} Warnings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-gray-700">{summary.not_run} Not Run</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {categories.find(c => c.id === selectedCategory)?.label}
            </h2>
            <button
              onClick={handleRunAllChecks}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" 
                />
              </svg>
              Run All Tests
            </button>
          </div>
        </div>

        {/* Checks List */}
        <div className="p-6 space-y-4">
          {filteredChecks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No tests available for this category yet.</p>
            </div>
          ) : (
            filteredChecks.map(check => (
              <LawCheckCard
                key={check.id}
                check={check}
                result={checkResults[check.id]}
                isRunning={runningChecks[check.id] || false}
                inputs={checkInputs[check.id] || {}}
                onRun={() => handleRunCheck(check.id)}
                onInputChange={(inputId, value) => handleInputChange(check.id, inputId, value)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}