// src/components/rotation/NightShiftInfoCard.tsx
'use client'

import { useState } from 'react'

export default function NightShiftInfoCard() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-purple-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌙</span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-purple-900">
              Night Shift Calculation
            </h3>
            <p className="text-xs text-purple-700">
              How hours are distributed across days and weeks
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-purple-600 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 text-sm text-purple-900 space-y-3">
          <div className="pt-2 border-t border-purple-200">
            <p className="font-medium mb-2">How it works:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Grid Placement:</strong> Night shifts are placed on the day they have the most hours.
              </li>
              <li>
                <strong>Example:</strong> A shift from 22:15 to 07:45 is placed on Wednesday, even though it starts Tuesday at 22:15.
              </li>
              <li>
                <strong>Daily Hours:</strong> The hours before midnight (1h 45m) count toward Tuesday, and hours after midnight (7h 45m) count toward Wednesday.
              </li>
              <li>
                <strong>Weekly Calculation:</strong> Full shift duration counts toward the week where it&lsquo;s placed, EXCEPT for Monday shifts.
              </li>
              <li>
                <strong>Monday Exception:</strong> If a night shift is on Monday, the hours before midnight (starting Sunday 22:15) count toward the previous week. If it&lsquo;s Monday of Week 1, these hours wrap to the last week of the rotation.
              </li>
            </ul>
          </div>

          <div className="bg-white rounded p-3 border border-purple-200">
            <p className="font-medium mb-2 text-purple-900">Visual Indicators:</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-lg">🌙</span>
              <span>= Shift crosses midnight</span>
            </div>
            <div className="mt-1 text-xs text-purple-700">
              The cell shows which day the shift actually starts on.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}