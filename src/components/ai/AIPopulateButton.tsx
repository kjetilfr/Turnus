// src/components/ai/AIPopulateButton.tsx - Button that opens AI populate modal
'use client'

import { useState } from 'react'
import TurnusPopulator from './TurnusPopulator'

interface AIPopulateButtonProps {
  planId: string
}

export default function AIPopulateButton({ planId }: AIPopulateButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-sm"
        title="Fyll plan med AI"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="hidden sm:inline">Fyll med AI</span>
        <span className="sm:hidden">AI</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <TurnusPopulator 
              planId={planId} 
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}