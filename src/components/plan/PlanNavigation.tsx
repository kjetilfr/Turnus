'use client'

import Link from 'next/link'
import type { Plan } from '@/types/scheduler'

interface PlanNavigationProps {
  plan: Plan
  userEmail?: string
}

export default function PlanNavigation({ plan, userEmail }: PlanNavigationProps) {
  return (
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
            {userEmail && (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {userEmail.split('@')[0]}
              </span>
            )}
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
  )
}