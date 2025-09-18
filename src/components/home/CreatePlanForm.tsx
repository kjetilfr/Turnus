// src/components/home/CreatePlanForm.tsx
'use client'

import InfoTooltip from '@/components/ui/InfoTooltip'
import { PLAN_TYPE_LABELS, PLAN_TYPE_DESCRIPTIONS } from '@/types/scheduler'

interface CreatePlanFormProps {
  newPlanName: string
  setNewPlanName: (name: string) => void
  newPlanDescription: string
  setNewPlanDescription: (description: string) => void
  newPlanDuration: number
  setNewPlanDuration: (duration: number) => void
  newPlanF1TimeOff: number
  setNewPlanF1TimeOff: (timeOff: number) => void
  newPlanType: 'main' | 'helping' // NEW
  setNewPlanType: (type: 'main' | 'helping') => void // NEW
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  creating: boolean
}

export default function CreatePlanForm({
  newPlanName,
  setNewPlanName,
  newPlanDescription,
  setNewPlanDescription,
  newPlanDuration,
  setNewPlanDuration,
  newPlanF1TimeOff,
  setNewPlanF1TimeOff,
  newPlanType, // NEW
  setNewPlanType, // NEW
  onSubmit,
  onCancel,
  creating
}: CreatePlanFormProps) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 mb-8 transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Create New Plan</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <form onSubmit={onSubmit} className="px-6 py-4">
        <div className="space-y-4">
          {/* Plan Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
              Plan Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewPlanType('main')}
                className={`p-4 text-left border rounded-lg transition-all duration-200 ${
                  newPlanType === 'main'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{PLAN_TYPE_LABELS.main}</h3>
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    newPlanType === 'main'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {newPlanType === 'main' && (
                      <div className="w-full h-full rounded-full bg-white scale-50"></div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {PLAN_TYPE_DESCRIPTIONS.main}
                </p>
              </button>
              
              <button
                type="button"
                onClick={() => setNewPlanType('helping')}
                className={`p-4 text-left border rounded-lg transition-all duration-200 ${
                  newPlanType === 'helping'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{PLAN_TYPE_LABELS.helping}</h3>
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    newPlanType === 'helping'
                      ? 'border-green-500 bg-green-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {newPlanType === 'helping' && (
                      <div className="w-full h-full rounded-full bg-white scale-50"></div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {PLAN_TYPE_DESCRIPTIONS.helping}
                </p>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="plan-name" className="block text-sm font-medium text-gray-900 dark:text-white">
              Plan Name
            </label>
            <input
              type="text"
              id="plan-name"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
              placeholder={newPlanType === 'main' ? "e.g., ICU Weekend Schedule" : "e.g., Extra Weekend Shifts"}
              required
            />
          </div>
          
          <div>
            <label htmlFor="plan-description" className="block text-sm font-medium text-gray-900 dark:text-white">
              Description (Optional)
            </label>
            <textarea
              id="plan-description"
              value={newPlanDescription}
              onChange={(e) => setNewPlanDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
              placeholder={
                newPlanType === 'main' 
                  ? "Brief description of this schedule plan..."
                  : "Describe these helping shifts..."
              }
            />
          </div>
          
          <div>
            <label htmlFor="plan-duration" className="block text-sm font-medium text-gray-900 dark:text-white">
              Duration (weeks)
            </label>
            <select
              id="plan-duration"
              value={newPlanDuration}
              onChange={(e) => setNewPlanDuration(parseInt(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => (
                <option key={week} value={week}>
                  {week} week{week !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              How many weeks this {newPlanType} plan will run for. 
              {newPlanType === 'main' ? ' F1-F5 shifts will be created automatically.' : ' Custom shifts for helping duties.'}
            </p>
          </div>
          
          {newPlanType === 'main' && (
            <div>
              <div className="flex items-center">
                <label htmlFor="f1-time-off" className="block text-sm font-medium text-gray-900 dark:text-white">
                  F1 Time Off (hours)
                </label>
                <InfoTooltip text="Can be down to 28 hours but no less. Default is 35 hours but check with your boss or union rep." />
              </div>
              <input
                type="number"
                id="f1-time-off"
                min="28"
                max="48"
                value={newPlanF1TimeOff}
                onChange={(e) => setNewPlanF1TimeOff(parseInt(e.target.value) || 35)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Minimum time off hours between F1 shifts. Used for schedule validation.
              </p>
            </div>
          )}

          {newPlanType === 'helping' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    Helping Plan
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    F1-F5 shifts won't be created automatically. You can create custom shifts to help colleagues or cover extra duties.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
          >
            {creating ? 'Creating...' : `Create ${PLAN_TYPE_LABELS[newPlanType]}`}
          </button>
        </div>
      </form>
    </div>
  )
}