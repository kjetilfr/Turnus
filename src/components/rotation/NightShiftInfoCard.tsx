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
              Nattevakt
            </h3>
            <p className="text-xs text-purple-700">
              Informasjon
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
            <p className="font-medium mb-2">Korleis du skal bruke nattevakt:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Plassering i turnus:</strong> Plasser nattevaktene på dagen med flest timer.
              </li>
              <li>
                <strong>Eksempel:</strong> Nattevakt fra kl. 22:15 til kl. 07:45 plasseres på Onsdar, sjølv om det starter kl. 22:15 Tysdag.
              </li>
            </ul>
          </div>

          <div className="bg-white rounded p-3 border border-purple-200">
            <p className="font-medium mb-2 text-purple-900">Visuell indikator:</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-lg">🌙</span>
              <span>= Vakten krysser midnatt</span>
            </div>
            <div className="mt-1 text-xs text-purple-700">
              Viser kva dag vakta starter.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}