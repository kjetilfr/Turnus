// src/components/plan/TestsTab.tsx
'use client'

import { useState } from 'react'
import { AVAILABLE_TESTS, runScheduleTests, type TestResult, type TestSuite } from '@/lib/schedule-tests'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Schedule Tests
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Validate your schedule against nursing regulations and best practices
          </p>
        </div>
      </div>

      {!hasRun ? (
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
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
              About Schedule Tests
            </h4>
            <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <p>• Tests validate your schedule against nursing regulations and best practices</p>
              <p>• F shift times are ignored in calculations - only placement matters for F shifts</p>
              <p>• Run tests regularly as you build your schedule to catch issues early</p>
              <p>• Some tests require both F shifts and regular shifts to be meaningful</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}