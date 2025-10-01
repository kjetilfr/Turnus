// src/components/plan/PlanDetails.tsx
'use client'

import { Plan } from '@/types/plan'
import Link from 'next/link'

interface PlanDetailsProps {
  plan: Plan
  basePlanName?: string | null
  showCalendarButton?: boolean
  showRotationButton?: boolean
  showLawChecksButton?: boolean
}

export default function PlanDetails({ 
  plan, 
  basePlanName,
  showCalendarButton = false,
  showRotationButton = false,
  showLawChecksButton = false
}: PlanDetailsProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Plan Details</h2>
        <div className="flex items-center gap-3">
          {showLawChecksButton && (
            <Link
              href={`/plans/${plan.id}/law-checks`}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              Law Checks
            </Link>
          )}
          {showCalendarButton && (
            <Link
              href={`/plans/${plan.id}/calendar`}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                />
              </svg>
              View Calendar
            </Link>
          )}
          {showRotationButton && (
            <Link
              href={`/plans/${plan.id}`}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 10h16M4 14h16M4 18h16" 
                />
              </svg>
              View Rotation
            </Link>
          )}
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <div className="text-sm text-gray-600 mb-1">Duration</div>
          <div className="text-lg font-semibold text-gray-900">
            {plan.duration_weeks} {plan.duration_weeks === 1 ? 'week' : 'weeks'}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600 mb-1">Type</div>
          <div className="text-lg font-semibold text-gray-900 capitalize">{plan.type}</div>
        </div>
        {basePlanName && (
          <div>
            <div className="text-sm text-gray-600 mb-1">Based On</div>
            <div className="text-lg font-semibold text-gray-900">{basePlanName}</div>
          </div>
        )}
      </div>
      {plan.description && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Description</div>
          <div className="text-gray-900">{plan.description}</div>
        </div>
      )}
    </div>
  )
}