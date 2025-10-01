// src/components/shift/ManageShiftsButton.tsx
'use client'

import Link from 'next/link'

interface ManageShiftsButtonProps {
  planId: string
}

export default function ManageShiftsButton({ planId }: ManageShiftsButtonProps) {
  return (
    <Link
      href={`/plans/${planId}/shifts`}
      className="inline-flex items-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors text-sm"
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
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
      Manage Shifts
    </Link>
  )
}