// src/components/shift/ImportRotationButton.tsx
'use client'

import { useState } from 'react'
import ImportRotationModal from './ImportRotationModal'

interface ImportRotationButtonProps {
  planId: string
  basePlanId: string | null
  planType: 'main' | 'helping' | 'year'
}

export default function ImportRotationButton({ planId, basePlanId, planType }: ImportRotationButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Only show for helping plans with a base plan
  if (planType !== 'helping' || !basePlanId) {
    return null
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
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
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
          />
        </svg>
        Importer Turnus
      </button>

      {isModalOpen && (
        <ImportRotationModal
          planId={planId}
          basePlanId={basePlanId}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  )
}