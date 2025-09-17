// src/components/plan/TestModal.tsx
'use client'

import { useState } from 'react'
import { AVAILABLE_TESTS, runScheduleTests, type TestResult, type TestSuite } from '@/lib/schedule-tests'
import type { Plan, Shift, Rotation } from '@/types/scheduler'

interface TestModalProps {
  isOpen: boolean
  onClose: () => void
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
}

export default function TestModal({ 
  isOpen, 
  onClose, 
  plan, 
  shifts, 
  rotations 
}: TestModalProps) {
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

  if (!isOpen) return null

  const passedTests = testResults.filter(r => r.passed).length
  const totalTests = testResults.length
  const hasViolations = testResults.some(r => r.violations.length > 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Schedule Tests
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Run validation tests on your schedule to identify potential issues
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!hasRun ? (
            <>
              {/* Test Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Select Tests to Run
                </h3>
                <div className="space-y-3">
                  {AVAILABLE_TESTS.map((test: TestSuite) => (
                    <label key={test.id} className="flex items-start space-x-3 cursor-pointer">
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
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {test.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Run Button */}
              <div className="flex justify-center">
                <button
                  onClick={runTests}
                  disabled={selectedTests.size === 0 || isRunning}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors duration-200"
                >
                  {isRunning ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Running Tests...
                    </span>
                  ) : (
                    `Run ${selectedTests.size} Test${selectedTests.size !== 1 ? 's' : ''}`
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Test Results */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Test Results
                  </h3>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    hasViolations
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                  }`}>
                    {passedTests}/{totalTests} Tests Passed
                  </div>
                </div>

                <div className="space-y-4">
                  {testResults.map((result) => (
                    <div
                      key={result.id}
                      className={`border rounded-lg p-4 ${
                        result.passed
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className={`font-medium ${
                            result.passed
                              ? 'text-green-900 dark:text-green-100'
                              : 'text-red-900 dark:text-red-100'
                          }`}>
                            {result.name}
                          </h4>
                          <p className={`text-sm ${
                            result.passed
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}>
                            {result.description}
                          </p>
                        </div>
                        <div className={`flex items-center ${
                          result.passed ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {result.passed ? (
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {result.details && (
                        <p className={`text-xs mb-2 ${
                          result.passed
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {result.details}
                        </p>
                      )}

                      {result.violations.length > 0 && (
                        <div className="mt-3">
                          <h5 className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                            Violations Found:
                          </h5>
                          <ul className="space-y-1">
                            {result.violations.map((violation, index) => (
                              <li key={index} className="text-sm text-red-700 dark:text-red-300 flex items-start">
                                <span className="mr-2">•</span>
                                <span>{violation}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              <div className="flex justify-center">
                <button
                  onClick={resetTests}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors duration-200"
                >
                  Run Different Tests
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}