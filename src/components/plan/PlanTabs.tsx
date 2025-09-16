'use client'

interface PlanTabsProps {
  activeTab: 'shifts' | 'rotation'
  shiftsCount: number
  onTabChange: (tab: 'shifts' | 'rotation') => void
}

export default function PlanTabs({ activeTab, shiftsCount, onTabChange }: PlanTabsProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
      <nav className="-mb-px flex space-x-8">
        <button
          onClick={() => onTabChange('shifts')}
          className={`py-2 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'shifts'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
          } transition-colors duration-200`}
        >
          Shifts ({shiftsCount})
        </button>
        <button
          onClick={() => onTabChange('rotation')}
          className={`py-2 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'rotation'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
          } transition-colors duration-200`}
        >
          Weekly Rotation
        </button>
      </nav>
    </div>
  )
}