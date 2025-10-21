// src/components/shift/CreateShiftButton.tsx
'use client'

import { useState } from 'react'
import CreateShiftModal from './CreateShiftModal'

interface CreateShiftButtonProps {
  planId: string
}

export default function CreateShiftButton({ planId }: CreateShiftButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 4v16m8-8H4" 
          />
        </svg>
        Ny vakt
      </button>

      {isModalOpen && (
        <CreateShiftModal
          planId={planId}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  )
}