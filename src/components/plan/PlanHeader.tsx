// src/components/plan/PlanHeader.tsx
'use client'

import Link from 'next/link'
import type { Plan } from '@/types/scheduler'

interface PlanHeaderProps {
  plan: Plan
  userEmail?: string
  activeTab: 'shifts' | 'rotation'
  setActiveTab: (tab: 'shifts' | 'rotation') => void
  shiftsCount: number
}

export default function PlanHeader({ 
  plan, 
  userEmail, 
  activeTab, 
  setActiveTab, 
  shiftsCount 
}: PlanHeaderProps) {
  return (
    <>
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow transition-colors duration-300 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
              >
                ← Back to Plans
              </Link>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{plan.name}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {userEmail?.split('@')[0]}
              </span>
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Plan Info */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{plan.name}</h1>
        {plan.description && (
          <p className="text-gray-600 dark:text-gray-300 mt-1">{plan.description}</p>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'shifts'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            } transition-colors duration-200`}
          >
            Shifts ({shiftsCount})
          </button>
          <button
            onClick={() => setActiveTab('rotation')}
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
    </>
  )
}