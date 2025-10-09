// src/components/plan/PlansList.tsx
'use client'

import { PlanWithBasePlan } from '@/types/plan'
import Link from 'next/link'

interface PlansListProps {
  plans: PlanWithBasePlan[]
}

export default function PlansList({ plans }: PlansListProps) {
  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">No Plans Yet</h3>
        <p className="text-gray-600 mb-6">
          Get started by creating your first scheduling plan
        </p>
        <Link
          href="/plans/new"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          Create Your First Plan
        </Link>
      </div>
    )
  }

  const getPlanTypeColor = (type: string) => {
    switch (type) {
      case 'main':
        return 'bg-blue-100 text-blue-800'
      case 'helping':
        return 'bg-green-100 text-green-800'
      case 'year':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPlanTypeLabel = (type: string) => {
    switch (type) {
      case 'main':
        return 'Main Plan'
      case 'helping':
        return 'Helping Plan'
      case 'year':
        return 'Year Plan'
      default:
        return type
    }
  }

  const getTariffavtaleLabel = (tariffavtale: string) => {
    switch (tariffavtale) {
      case 'ks':
        return 'KS'
      case 'staten':
        return 'Staten'
      case 'oslo':
        return 'Oslo'
      case 'aml':
        return 'Ingen'
      default:
        return tariffavtale
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tariffavtale
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Base Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {plans.map((plan) => {
              const rowClasses = 'hover:bg-gray-50 transition-colors'

              return (
                <tr key={plan.id} className={rowClasses}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {plan.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(plan.date_started).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPlanTypeColor(plan.type)}`}>
                      {getPlanTypeLabel(plan.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                      {getTariffavtaleLabel(plan.tariffavtale)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.duration_weeks} {plan.duration_weeks === 1 ? 'week' : 'weeks'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {plan.base_plan ? plan.base_plan.name : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="max-w-xs truncate">
                      {plan.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/plans/${plan.id}`}
                        className="text-indigo-600 hover:text-indigo-900 font-medium"
                      >
                        View
                      </Link>
                      <Link
                        href={`/plans/${plan.id}/edit`}
                        className="text-gray-600 hover:text-gray-900 font-medium"
                      >
                        Edit
                      </Link>
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