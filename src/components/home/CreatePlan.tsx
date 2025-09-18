'use client'

import InfoTooltip from '@/components/ui/InfoTooltip'

interface CreatePlanFormProps {
  newPlanName: string
  setNewPlanName: (name: string) => void
  newPlanDescription: string
  setNewPlanDescription: (description: string) => void
  newPlanDuration: number
  setNewPlanDuration: (duration: number) => void
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
              placeholder="e.g., ICU Weekend Schedule"
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
              placeholder="Brief description of this schedule plan..."
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
              How many weeks this schedule plan will run for. F1-F5 shifts will be created automatically.
            </p>
          </div>
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
            {creating ? 'Creating...' : 'Create Plan'}
          </button>
        </div>
      </form>
    </div>
  )
}