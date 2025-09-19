// src/components/plan/TestsTab.tsx
'use client'

import { useState, useEffect } from 'react'
import { AVAILABLE_TESTS, runScheduleTests, type TestResult, type TestSuite } from '@/lib/schedule-tests'
import FullCalendarView from '@/components/plan/FullCalendarView'
import type { Plan, Shift, Rotation } from '@/types/scheduler'

interface TestsTabProps {
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
}

export default function TestsTab({ plan, shifts, rotations }: TestsTabProps) {
  const [selectedTests, setSelectedTests] = useState<Set<string>>(
    new Set(AVAILABLE_TESTS.filter(t => t.enabled).map(t => t.id))
  )
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  
  // For helping plans - calendar view with date persistence
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [isDateLoaded, setIsDateLoaded] = useState(false)

  const isHelpingPlan = plan.plan_type === 'helping'

  // Load saved date from localStorage when component mounts
  useEffect(() => {
    if (isHelpingPlan && !isDateLoaded) {
      const storageKey = `helping-plan-date-${plan.id}`
      const savedDate = localStorage.getItem(storageKey)
      
      if (savedDate) {
        try {
          const parsedDate = new Date(savedDate)
          // Validate that the date is valid and not in the past
          if (!isNaN(parsedDate.getTime()) && parsedDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
            setSelectedStartDate(parsedDate)
            setShowCalendar(true)
          } else if (!isNaN(parsedDate.getTime())) {
            // If date is valid but in the past, still load it but let user know
            setSelectedStartDate(parsedDate)
            setShowCalendar(true)
          }
        } catch (error) {
          console.error('Error parsing saved date:', error)
          // Clear invalid date from storage
          localStorage.removeItem(storageKey)
        }
      }
      setIsDateLoaded(true)
    }
  }, [isHelpingPlan, plan.id, isDateLoaded])

  const toggleTest = (testId: string) => {
    const newSelected = new Set(selectedTests)
    if (newSelected.has(testId)) {
      newSelected.delete(testId)
    } else {
      newSelected.add(testId)
    }
    setSelectedTests(newSelected)
  }

  const runTests = async () => {
    if (selectedTests.size === 0) {
      return
    }

    setIsRunning(true)
    
    // Add a small delay to show the running state
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const results = runScheduleTests(plan, shifts, rotations, Array.from(selectedTests))
    setTestResults(results)
    setHasRun(true)
    setIsRunning(false)
  }

  const resetTests = () => {
    setTestResults([])
    setHasRun(false)
    setSelectedTests(new Set(AVAILABLE_TESTS.filter(t => t.enabled).map(t => t.id)))
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value
    const storageKey = `helping-plan-date-${plan.id}`
    
    if (dateString) {
      const newDate = new Date(dateString)
      setSelectedStartDate(newDate)
      setShowCalendar(true)
      
      // Save to localStorage
      try {
        localStorage.setItem(storageKey, newDate.toISOString())
      } catch (error) {
        console.error('Error saving date to localStorage:', error)
      }
    } else {
      setSelectedStartDate(null)
      setShowCalendar(false)
      
      // Remove from localStorage when cleared
      try {
        localStorage.removeItem(storageKey)
      } catch (error) {
        console.error('Error removing date from localStorage:', error)
      }
    }
  }

  const clearDate = () => {
    const storageKey = `helping-plan-date-${plan.id}`
    setSelectedStartDate(null)
    setShowCalendar(false)
    
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.error('Error removing date from localStorage:', error)
    }
  }

  const setToToday = () => {
    const today = new Date()
    const storageKey = `helping-plan-date-${plan.id}`
    
    setSelectedStartDate(today)
    setShowCalendar(true)
    
    try {
      localStorage.setItem(storageKey, today.toISOString())
    } catch (error) {
      console.error('Error saving date to localStorage:', error)
    }
  }

  const setToNextMonday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilMonday)
    
    const storageKey = `helping-plan-date-${plan.id}`
    setSelectedStartDate(nextMonday)
    setShowCalendar(true)
    
    try {
      localStorage.setItem(storageKey, nextMonday.toISOString())
    } catch (error) {
      console.error('Error saving date to localStorage:', error)
    }
  }

  if (shifts.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No shifts to test</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          You need to create shifts before running schedule tests.
        </p>
      </div>
    )
  }

  const passedTests = testResults.filter(r => r.passed).length
  const totalTests = testResults.length
  const hasViolations = testResults.some(r => r.violations.length > 0)

  // Check if the selected date is in the past
  const isDateInPast = selectedStartDate && selectedStartDate < new Date(new Date().setHours(0, 0, 0, 0))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isHelpingPlan ? 'Schedule Calendar' : 'Schedule Tests'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isHelpingPlan 
              ? 'View your helping plan schedule in calendar format'
              : 'Validate your schedule against nursing regulations and best practices'
            }
          </p>
        </div>
      </div>

      {isHelpingPlan ? (
        <div className="space-y-6">
          {/* Start Date Selection */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select Start Date</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Choose when your {plan.duration_weeks}-week helping plan should start
                {selectedStartDate && (
                  <span className="block mt-1 font-medium text-blue-600 dark:text-blue-400">
                    Currently set: {selectedStartDate.toLocaleDateString('nb-NO')}
                    {isDateInPast && <span className="text-amber-600 dark:text-amber-400"> (Past date)</span>}
                  </span>
                )}
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="max-w-xs">
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={selectedStartDate ? selectedStartDate.toISOString().split('T')[0] : ''}
                    onChange={handleStartDateChange}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                  />
                  
                  {/* Quick Date Options */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={setToToday}
                      className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-md transition-colors duration-200"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={setToNextMonday}
                      className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-800 dark:text-green-200 rounded-md transition-colors duration-200"
                    >
                      Next Monday
                    </button>
                    {selectedStartDate && (
                      <button
                        type="button"
                        onClick={clearDate}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors duration-200"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  
                  {selectedStartDate && (
                    <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <p>
                        <strong>Plan Period:</strong> {selectedStartDate.toLocaleDateString('nb-NO')} to{' '}
                        {new Date(selectedStartDate.getTime() + (plan.duration_weeks * 7 - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('nb-NO')}
                      </p>
                      <p>
                        <strong>Duration:</strong> {plan.duration_weeks} week{plan.duration_weeks !== 1 ? 's' : ''} ({plan.duration_weeks * 7} days)
                      </p>
                      {isDateInPast && (
                        <p className="text-amber-600 dark:text-amber-400 font-medium">
                          ⚠️ This date is in the past. Consider updating to a future date.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          {showCalendar && selectedStartDate && (
            <FullCalendarView 
              plan={plan}
              shifts={shifts}
              rotations={rotations}
              startDate={selectedStartDate}
            />
          )}

          {/* Schedule Tests (still available for helping plans) */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Optional: Run Schedule Tests</h3>
                <button
                  onClick={() => {
                    setHasRun(false)
                    setTestResults([])
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Show Tests
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Even helping plans can be validated against nursing regulations
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Main Plans - Original Test Interface */
        !hasRun ? (
          <div className="space-y-6">
            {/* Test Selection */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Available Tests</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Select which validation tests you want to run on your schedule
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {AVAILABLE_TESTS.map((test: TestSuite) => (
                    <label key={test.id} className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                      <input
                        type="checkbox"
                        checked={selectedTests.has(test.id)}
                        onChange={() => toggleTest(test.id)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {test.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {test.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Run Button */}
            <div className="flex justify-center">
              <button
                onClick={runTests}
                disabled={selectedTests.size === 0 || isRunning}
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors duration-200 shadow-sm"
              >
                {isRunning ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Running Tests...
                  </span>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run {selectedTests.size} Test{selectedTests.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Test Results Header */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Test Results
                  </h3>
                  <div className="flex items-center space-x-4">
                    <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                      hasViolations
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    }`}>
                      {passedTests}/{totalTests} Tests Passed
                    </div>
                    <button
                      onClick={resetTests}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors duration-200"
                    >
                      Run Different Tests
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {testResults.map((result) => (
                    <div
                      key={result.id}
                      className={`border rounded-lg p-6 ${
                        result.passed
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className={`flex items-center ${
                              result.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {result.passed ? (
                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <h4 className={`font-semibold text-lg ${
                              result.passed
                                ? 'text-green-900 dark:text-green-100'
                                : 'text-red-900 dark:text-red-100'
                            }`}>
                              {result.name}
                            </h4>
                          </div>
                          <p className={`text-sm mb-2 ${
                            result.passed
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}>
                            {result.description}
                          </p>
                          {result.details && (
                            <p className={`text-xs ${
                              result.passed
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {result.details}
                            </p>
                          )}
                        </div>
                      </div>

                      {result.violations.length > 0 && (
                        <div className="mt-4 border-t border-red-200 dark:border-red-800 pt-4">
                          <h5 className="text-sm font-medium text-red-900 dark:text-red-100 mb-3 flex items-center">
                            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {result.violations.length} Violation{result.violations.length !== 1 ? 's' : ''} Found
                          </h5>
                          <div className="space-y-2">
                            {result.violations.map((violation, index) => (
                              <div key={index} className="flex items-start bg-red-100 dark:bg-red-900/30 rounded-lg p-3">
                                <div className="flex-shrink-0 mr-3 mt-0.5">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                </div>
                                <span className="text-sm text-red-800 dark:text-red-200">{violation}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
              {isHelpingPlan ? 'About Helping Plan Calendar' : 'About Schedule Tests'}
            </h4>
            <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              {isHelpingPlan ? (
                <>
                  <p>• Your selected start date is automatically saved and will be remembered next time</p>
                  <p>• Use the quick buttons (Today, Next Monday) for common date selections</p>
                  <p>• The calendar shows your {plan.duration_weeks}-week helping plan with Norwegian date formatting</p>
                  <p>• F shift times are ignored - only placement and visual representation matter</p>
                  <p>• You can still run validation tests on your helping plan if needed</p>
                </>
              ) : (
                <>
                  <p>• Tests validate your schedule against nursing regulations and best practices</p>
                  <p>• F shift times are ignored in calculations - only placement matters for F shifts</p>
                  <p>• Run tests regularly as you build your schedule to catch issues early</p>
                  <p>• Some tests require both F shifts and regular shifts to be meaningful</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}