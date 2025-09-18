'use client'

import Link from 'next/link'
import type { Plan } from '@/types/scheduler'
import { PLAN_TYPE_LABELS } from '@/types/scheduler'

interface PlansGridProps {
  plans: Plan[]
  onDeletePlan: (planId: string) => void
  onShowCreateForm: () => void
}

export default function PlansGrid({ plans, onDeletePlan, onShowCreateForm }: PlansGridProps) {
  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No plans yet</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating your first schedule plan.</p>
        <div className="mt-6">
          <button
            onClick={onShowCreateForm}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Plan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map((plan) => {
        const planType = plan.plan_type || 'main' // Default to main for legacy plans
        const isMainPlan = planType === 'main'
        
        return (
          <div key={plan.id} className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300 hover:shadow-lg">
            <div className="px-6 py-4">
              {/* Plan Type Badge */}
              <div className="flex items-center justify-between mb-3">
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isMainPlan 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                }`}>
                  {isMainPlan ? (
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                  {PLAN_TYPE_LABELS[planType]}
                </div>
                <button
                  onClick={() => onDeletePlan(plan.id)}
                  className="text-red-400 hover:text-red-600 transition-colors duration-200"
                  title="Delete plan"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Plan Name */}
              <div className="mb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{plan.name}</h3>
              </div>

              {/* Plan Description */}
              {plan.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{plan.description}</p>
              )}

              {/* Plan Details */}
              <div className="space-y-1 mb-4">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Duration:</span>
                  <span>{plan.duration_weeks} week{plan.duration_weeks !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Created:</span>
                  <span>{new Date(plan.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end">
                <Link
                  href={`/plan/${plan.id}`}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  Manage
                  <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}