// src/components/lawChecks/LawChecksView.tsx
'use client'

import { useState, useMemo } from 'react'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'
import { LAW_CHECKS } from '@/lib/lawChecks'
import { LawCheckResult, LawCheckStatus, LawCheckCategory } from '@/types/lawCheck'
import LawCheckCard from '@/components/lawChecks/LawCheckCard'

interface LawChecksViewProps {
  rotations: Rotation[]
  shifts: Shift[]
  plan: Plan
  basePlanRotations?: Rotation[]
  basePlanShifts?: Shift[]
  basePlan?: Plan  // ADDED: the full base plan object
}

export default function LawChecksView({ 
  rotations, 
  shifts, 
  plan, 
  basePlanRotations, 
  basePlanShifts,
  basePlan  // ADDED
}: LawChecksViewProps) {

  const [checkResults, setCheckResults] = useState<Record<string, LawCheckResult>>({})
  const [runningChecks, setRunningChecks] = useState<Record<string, boolean>>({})
  const [checkInputs, setCheckInputs] = useState<Record<string, Record<string, number | string | boolean>>>(() => {
    // Initialize inputs with default values from checks
    const initial: Record<string, Record<string, number | string | boolean>> = {}
    LAW_CHECKS.forEach(check => {
      if (check.inputs) {
        initial[check.id] = {}
        check.inputs.forEach(input => {
          initial[check.id][input.id] = input.defaultValue
        })
      }
    })
    return initial
  })
  const [enabledChecks, setEnabledChecks] = useState<Record<string, boolean>>(() => {
    // Initialize all checks as enabled by default
    const initial: Record<string, boolean> = {}
    LAW_CHECKS.forEach(check => {
      initial[check.id] = true
    })
    return initial
  })

  // Filter checks applicable to this plan type AND tariffavtale
  const applicableChecks = useMemo(() => {
    return LAW_CHECKS.filter(check => {
      // If it's a shared check, verify it applies to this plan type
      if (check.category === 'shared') {
        const appliesToPlanType = check.applicableTo?.includes(plan.type as LawCheckCategory) ?? false
        if (!appliesToPlanType) return false
      } else if (check.category !== plan.type) {
        // If it's a specific category check, it must match the plan type
        return false
      }

      return true
    })
  }, [plan.type])

  const handleRunCheck = (checkId: string) => {
    const check = applicableChecks.find(c => c.id === checkId)
    if (!check || !enabledChecks[checkId]) return

    setRunningChecks(prev => ({ ...prev, [checkId]: true }))

    // Small delay to show loading state
    setTimeout(() => {
      const result = check.run({
        rotations,
        shifts,
        plan,
        inputs: checkInputs[checkId] || {},
        basePlanRotations,
        basePlanShifts,
        basePlan  // ADDED: pass the full base plan object
      })

      setCheckResults(prev => ({ ...prev, [checkId]: result }))
      setRunningChecks(prev => ({ ...prev, [checkId]: false }))
    }, 100)
  }

  const handleRunAllChecks = () => {
    applicableChecks.forEach(check => {
      if (enabledChecks[check.id]) {
        handleRunCheck(check.id)
      }
    })
  }

  const handleToggleCheck = (checkId: string, enabled: boolean) => {
    setEnabledChecks(prev => ({ ...prev, [checkId]: enabled }))
    
    // Clear result when disabled
    if (!enabled) {
      setCheckResults(prev => {
        const newResults = { ...prev }
        delete newResults[checkId]
        return newResults
      })
    }
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

  // Calculate summary statistics (only for enabled checks)
  const summary = applicableChecks.reduce((acc, check) => {
    if (!enabledChecks[check.id]) {
      acc.disabled++
      return acc
    }
    
    const result = checkResults[check.id]
    if (result) {
      acc[result.status]++
    } else {
      acc.not_run++
    }
    return acc
  }, { pass: 0, fail: 0, warning: 0, not_run: 0, disabled: 0 } as Record<LawCheckStatus | 'disabled', number>)

  // Count by law type
  const amlCount = applicableChecks.filter(c => c.lawType === 'aml').length
  const htaCount = applicableChecks.filter(c => c.lawType === 'hta').length
  const enabledCount = applicableChecks.filter(c => enabledChecks[c.id]).length

  return (
    <div className="space-y-6">

      {/* Main Card */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Summary Bar */}
        {Object.values(checkResults).length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="flex items-center gap-6 text-sm">
              <div className="font-semibold text-gray-700">Resultat:</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-700">{summary.pass} Godkjend</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-700">{summary.fail} Mislyktes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-700">{summary.warning} Advarsel</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-gray-700">{summary.not_run} Ikkje kjørt</span>
              </div>
              {summary.disabled > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                  <span className="text-gray-700">{summary.disabled} Deaktivert</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Lovsjekkar
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {enabledCount} av {applicableChecks.length} {applicableChecks.length !== 1} testar er aktivert
              </p>
            </div>
            {applicableChecks.length > 0 && enabledCount > 0 && (
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
                Kjør alle
              </button>
            )}
          </div>
        </div>

        {/* Checks List */}
        <div className="p-6 space-y-4">
          {applicableChecks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-lg font-semibold mb-2">No tests available</p>
              <p className="text-sm">
                Det er ingen lovsjekkar for plan av type {plan.type} {
                  plan.tariffavtale === 'ks' ? 'KS' :
                  plan.tariffavtale === 'staten' ? 'Staten' :
                  plan.tariffavtale === 'oslo' ? 'Oslo Kommune' :
                  plan.tariffavtale === 'spekter' ? 'Spekter' :
                  'Ingen (AML only)'
                } tariffavtale.
              </p>
            </div>
          ) : (
            applicableChecks.map(check => (
              <LawCheckCard
                key={check.id}
                check={check}
                result={checkResults[check.id]}
                isRunning={runningChecks[check.id] || false}
                isEnabled={enabledChecks[check.id] || false}
                inputs={checkInputs[check.id] || {}}
                onRun={() => handleRunCheck(check.id)}
                onToggle={(enabled) => handleToggleCheck(check.id, enabled)}
                onInputChange={(inputId, value) => handleInputChange(check.id, inputId, value)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}