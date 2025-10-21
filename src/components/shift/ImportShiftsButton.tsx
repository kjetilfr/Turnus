// src/components/shift/ImportShiftsButton.tsx
'use client'

import { useState } from 'react'
import ImportShiftsModal from './ImportShiftsModal'

interface ImportShiftsButtonProps {
  planId: string
}

export default function ImportShiftsButton({ planId }: ImportShiftsButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 bg-white border-2 border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
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
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
          />
        </svg>
        Importer Vakter
      </button>

      {isModalOpen && (
        <ImportShiftsModal
          currentPlanId={planId}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  )
}