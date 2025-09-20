// src/components/home/CompactPlansGrid.tsx
'use client'

import Link from 'next/link'
import type { Plan } from '@/types/scheduler'
import { PLAN_TYPE_LABELS } from '@/types/scheduler'

interface CompactPlansGridProps {
  plans: Plan[]
  onDeletePlan: (planId: string) => void
  onShowCreateForm: () => void
}

export default function CompactPlansGrid({ plans, onDeletePlan, onShowCreateForm }: CompactPlansGridProps) {
  if (plans.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No plans yet</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Get started by creating your first schedule plan.</p>
        <div className="mt-4">
          <button
            onClick={onShowCreateForm}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Plan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded border border-gray-200 dark:border-gray-700 transition-colors duration-300 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <th className="px-2 py-1.5 text-left font-medium text-gray-900 dark:text-white">Type</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-900 dark:text-white">Name</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-900 dark:text-white">Description</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-900 dark:text-white">Duration</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-900 dark:text-white">Created</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-900 dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, index) => {
              const planType = plan.plan_type || 'main'
              const isMainPlan = planType === 'main'
              
              return (
                <tr key={plan.id} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-25 dark:hover:bg-gray-750 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750/50'}`}>
                  <td className="px-2 py-1.5">
                    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      isMainPlan 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    }`}>
                      {isMainPlan ? (
                        <svg className="w-2.5 h-2.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-2.5 h-2.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      )}
                      {PLAN_TYPE_LABELS[planType]}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-gray-900 dark:text-white truncate max-w-32" title={plan.name}>
                      {plan.name}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-gray-600 dark:text-gray-300 truncate max-w-48" title={plan.description || 'No description'}>
                      {plan.description || '-'}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-gray-900 dark:text-white">
                      {plan.duration_weeks}w
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(plan.created_at).toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: '2-digit',
                        year: '2-digit'
                      })}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center space-x-1">
                      <Link
                        href={`/plan/${plan.id}`}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
                        title="Manage plan"
                      >
                        <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Manage
                      </Link>
                      <button
                        onClick={() => onDeletePlan(plan.id)}
                        className="inline-flex items-center p-1 text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                        title="Delete plan"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}