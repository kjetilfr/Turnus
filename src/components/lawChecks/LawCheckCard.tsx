// src/components/lawChecks/LawCheckCard.tsx
'use client'

import { LawCheck, LawCheckResult, LawCheckStatus } from '@/types/lawCheck'
import { useState } from 'react'

interface LawCheckCardProps {
  check: LawCheck
  result?: LawCheckResult
  isRunning: boolean
  isEnabled: boolean
  inputs: Record<string, number | string | boolean>
  onRun: () => void
  onToggle: (enabled: boolean) => void
  onInputChange: (inputId: string, value: number | string | boolean) => void
}

export default function LawCheckCard({
  check,
  result,
  isRunning,
  isEnabled,
  inputs,
  onRun,
  onToggle,
  onInputChange
}: LawCheckCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getStatusColor = (status: LawCheckStatus) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'fail':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const getStatusIcon = (status: LawCheckStatus) => {
    switch (status) {
      case 'pass':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'fail':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  // Special handling for average work hours check
  const isAverageHoursCheck = check.id === 'average-work-hours'
  const agreementType = inputs.agreementType as string || 'none'

  // Special handling for F3 holiday compensation check
  const isF3Check = check.id === 'f3-holiday-compensation'
  const calculationMethod = inputs.calculationMethod as string || 'hovedregelen'

  return (
    <div className={`border-2 rounded-lg transition-all ${
      !isEnabled 
        ? 'bg-gray-100 border-gray-300 opacity-60'
        : result ? getStatusColor(result.status) : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Checkbox */}
          <div className="flex items-start gap-3 flex-shrink-0">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-start gap-3 flex-1 min-w-0">
            {result && isEnabled && (
              <div className="mt-0.5">
                {getStatusIcon(result.status)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-lg font-semibold text-gray-900">
                  {check.name}
                </h3>
                {/* Law Type Badge */}
                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                  check.lawType === 'aml' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {check.lawType.toUpperCase()}
                </span>
                {/* Law References */}
                {check.lawReferences && check.lawReferences.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {check.lawReferences.map((ref, index) => (
                      <a
                        key={index}
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        title={ref.title}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {ref.title.length > 20 ? `${ref.title.substring(0, 20)}...` : ref.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {check.description}
              </p>

              {/* Average Hours Check - Agreement Type Selection */}
              {isEnabled && isAverageHoursCheck && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avtaletype:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`agreement-${check.id}`}
                        value="none"
                        checked={agreementType === 'none'}
                        onChange={() => onInputChange('agreementType', 'none')}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Standard ingen avtale (aml) - 9t vakt, 35.5t/veka</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`agreement-${check.id}`}
                        value="type1"
                        checked={agreementType === 'type1'}
                        onChange={() => onInputChange('agreementType', 'type1')}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Individuell avtale med arbeidstakar - 10t vakt, 50t/veka, 48t/veka over 8-veker gjennomsnitt</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`agreement-${check.id}`}
                        value="type2"
                        checked={agreementType === 'type2'}
                        onChange={() => onInputChange('agreementType', 'type2')}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Avtale med tillitsvalgte - 12,5t vakt, 54t/veka, 48t/veka over 8-veker gjennomsnitt</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`agreement-${check.id}`}
                        value="type3"
                        checked={agreementType === 'type3'}
                        onChange={() => onInputChange('agreementType', 'type3')}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Arbeidstilsynet - 13t vakt, 48t/veka over 8-veker gjennomsnitt</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`agreement-${check.id}`}
                        value="type4"
                        checked={agreementType === 'type4'}
                        onChange={() => onInputChange('agreementType', 'type4')}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Forbund sentralt - (ingen begrensningar)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* F3 Check - Calculation Method Selection */}
              {isEnabled && isF3Check && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calculation Method:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`calculation-${check.id}`}
                        value="hovedregelen"
                        checked={calculationMethod === 'hovedregelen'}
                        onChange={() => onInputChange('calculationMethod', 'hovedregelen')}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Hovudregelen (Annakvar raud dag fri)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`calculation-${check.id}`}
                        value="annenhver"
                        checked={calculationMethod === 'annenhver'}
                        onChange={() => onInputChange('calculationMethod', 'annenhver')}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Annakvar beregning og fri fordeling</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`calculation-${check.id}`}
                        value="gjennomsnitt"
                        checked={calculationMethod === 'gjennomsnitt'}
                        onChange={() => onInputChange('calculationMethod', 'gjennomsnitt')}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Gjennomsnittsberegning</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Input Fields */}
              {isEnabled && check.inputs && check.inputs.length > 0 && (
                
                <div className="space-y-3 mb-3">
                  {check.inputs
                    .filter(input => {
                      //ShowIf check
                      if (input.showIf) {
                        const { field, equals } = input.showIf
                        return inputs[field] === equals
                      }
                      // Filter inputs based on agreement type for average hours check
                      if (!isAverageHoursCheck) return true
                      if (input.id === 'agreementType') return false // Already handled above
                      
                      // Show only relevant inputs for selected agreement type
                      if (agreementType === 'none') {
                        return input.id.startsWith('standard')
                      } else if (agreementType === 'type1') {
                        return input.id.startsWith('type1')
                      } else if (agreementType === 'type2') {
                        return input.id.startsWith('type2')
                      } else if (agreementType === 'type3') {
                        return input.id.startsWith('type3')
                      } else if (agreementType === 'type4') {
                        return input.id.startsWith('type4')
                      }
                      
                      return true
                    })
                    .map(input => {
                      const currentValue = (inputs[input.id] ?? input.defaultValue) as number
                      const showWarningF1 = input.id === 'minRestHours' && input.type === 'number' && currentValue < 28
                      const showWarningShiftLengthType0 = input.id === 'standardMaxShiftHours' && input.type === 'number' && currentValue > 9
                      const showWarningShiftLengthType1 = input.id === 'type1MaxShiftHours' && input.type === 'number' && currentValue > 10
                      const showWarningShiftLengthType2 = input.id === 'type2MaxShiftHours' && input.type === 'number' && currentValue > 12.5
                      const showWarningShiftLengthType3 = input.id === 'type3MaxShiftHours' && input.type === 'number' && currentValue > 13
                      const showWarningweeklyHoursType0 = input.id === 'standardMaxWeeklyHours"' && input.type === 'number' && currentValue > 40
                      const showWarningweeklyHoursType1 = input.id === 'type1MaxWeeklyHours' && input.type === 'number' && currentValue > 50
                      const showWarningweeklyHoursType2 = input.id === 'type2MaxWeeklyHours' && input.type === 'number' && currentValue > 54
                      const showWarning8weeksHoursType1 = input.id === 'type1Max8WeekHours"' && input.type === 'number' && currentValue > 48
                      const showWarning8weeksHoursType2 = input.id === 'type2Max8WeekHours' && input.type === 'number' && currentValue > 48
                      const showWarning8weeksHoursType3 = input.id === 'type3Max8WeekHours' && input.type === 'number' && currentValue > 48

                      const showWarningShiftRestPeriod = input.id === 'minShiftRestHours' && input.type === 'number' && !isNaN(currentValue) && currentValue < 8
                      return (
                        <div key={input.id}>
                          <div className="flex items-center gap-3">
                            <label htmlFor={`${check.id}-${input.id}`} className="text-sm font-medium text-gray-700 min-w-[180px]">
                              {input.label}:
                            </label>
                            {input.type === 'number' && (
                            <div className="flex items-center gap-2">
                              <input
                                id={`${check.id}-${input.id}`}
                                type="number"
                                value={isNaN(currentValue) ? '' : currentValue}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? NaN : parseFloat(e.target.value)
                                  onInputChange(input.id, val)
                                }}
                                min={input.min}
                                max={input.max}
                                step={input.step}
                                className={`w-24 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm ${
                                  showWarningF1 ? 'border-yellow-400' : 'border-gray-300'
                                }`}
                              />
                              {input.unit && (
                                <span className="text-sm text-gray-600">{input.unit}</span>
                              )}
                            </div>
                          )}
                            {input.type === 'text' && (
                              <input
                                id={`${check.id}-${input.id}`}
                                type="text"
                                value={(inputs[input.id] ?? input.defaultValue) as string}
                                onChange={(e) => onInputChange(input.id, e.target.value)}
                                className="flex-1 max-w-xs px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                              />
                            )}
                            {input.type === 'boolean' && (
                              <input
                                id={`${check.id}-${input.id}`}
                                type="checkbox"
                                checked={(inputs[input.id] ?? input.defaultValue) as boolean}
                                onChange={(e) => onInputChange(input.id, e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                            )}
                          </div>
                          {showWarningF1 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>
                                Advarsel: Timar under minimum på 28 timar. Dette kan vere i strid med lovkrava til kviletid.
                              </span>
                            </div>
                          )}
                          {showWarningShiftLengthType0 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Vakttimar overstig maksimum tillate for denne avtaletypen (9 timar).
                              </span>
                            </div>
                          )}
                          {showWarningShiftLengthType1 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Vakttimar overstig maksimum tillate for denne avtaletypen (10 timar).
                              </span>
                            </div>
                          )}
                          {showWarningShiftLengthType2 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Vakttimar overstig maksimum tillate for denne avtaletypen (12,5 timar).
                              </span>
                            </div>
                          )}
                          {showWarningShiftLengthType3 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Vakttimar overstig maksimum tillate for denne avtaletypen (13 timar).
                              </span>
                            </div>
                          )}
                          {showWarningweeklyHoursType0 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Timetal per veke overstig maksimum tillate for denne avtaletypen (35,5 (hta) i turnus, 37,5 (hta) i dagjobb).
                              </span>
                            </div>
                          )}
                          {showWarningweeklyHoursType1 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Timetal per veke overstig maksimum tillate for denne avtaletypen (50 t).
                              </span>
                            </div>
                          )}
                          {showWarningweeklyHoursType2 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Timetal per veke overstig maksimum tillate for denne avtaletypen (54 t).
                              </span>
                            </div>
                          )}
                          {showWarning8weeksHoursType1 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Timetal over 8-vekoperioda overstig maksimum tillate for denne avtaletypen (48 t).
                              </span>
                            </div>
                          )}
                          {showWarning8weeksHoursType2 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Timetal over 8-vekoperioda overstig maksimum tillate for denne avtaletypen (48 t).
                              </span>
                            </div>
                          )}
                          {showWarning8weeksHoursType3 && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <span>
                                Advarsel: Timetal over 8-vekoperioda overstig maksimum tillate for denne avtaletypen (48 t).
                              </span>
                            </div>
                          )}
                          {showWarningShiftRestPeriod && (
                            <div className="ml-[192px] mt-1 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>
                                Advarsel: Timetal under minimum på 8 timar. Dette kan vere i strid med lovkrava til kviletid.
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Result Message */}
              {result && isEnabled && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    {result.message}
                  </p>
                  
                  {/* Details toggle for long results */}
                  {result.details && result.details.length > 0 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      {isExpanded ? 'Vis' : 'Sjul'} Detaljar
                      <svg 
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Run Button */}
          {isEnabled && (
            <button
              onClick={onRun}
              disabled={isRunning}
              className="flex-shrink-0 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isRunning ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Kjørar...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Kjør lovsjekk
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Expanded Details */}
      {isExpanded && result?.details && result.details.length > 0 && isEnabled && (
        <div className="px-4 pb-4 border-t border-gray-300">
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Detaljar:</h4>
            <ul className="space-y-1">
              {result.details.map((detail, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Disabled Overlay Message */}
      {!isEnabled && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 italic">Denne testen er ikkje aktivert, aktiver for å kjøre.</p>
        </div>
      )}
    </div>
  )
}