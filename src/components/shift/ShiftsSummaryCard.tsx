// src/components/shift/ShiftsSummaryCard.tsx
'use client'

import { Shift } from '@/types/shift'

interface ShiftsSummaryCardProps {
  defaultShifts: Shift[]
  customShifts: Shift[]
}

export default function ShiftsSummaryCard({ defaultShifts, customShifts }: ShiftsSummaryCardProps) {
  return (
    <div className="grid md:grid-cols-2 gap-4 mb-4">
      {/* Default Shifts */}
      <div>
        <h3 className="text-xs font-medium text-gray-700 mb-2">Default Shifts</h3>
        <div className="flex flex-wrap gap-1.5">
          {defaultShifts.length > 0 ? (
            defaultShifts.map((shift) => (
              <span 
                key={shift.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
              >
                {shift.name}
              </span>
            ))
          ) : (
            <p className="text-xs text-gray-500">No default shifts</p>
          )}
        </div>
      </div>

      {/* Custom Shifts */}
      <div>
        <h3 className="text-xs font-medium text-gray-700 mb-2">Custom Shifts</h3>
        <div className="flex flex-wrap gap-1.5">
          {customShifts.length > 0 ? (
            <>
              {customShifts.slice(0, 5).map((shift) => (
                <span 
                  key={shift.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                  title={shift.start_time && shift.end_time ? `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}` : ''}
                >
                  {shift.name}
                </span>
              ))}
              {customShifts.length > 5 && (
                <span className="text-xs text-gray-500 italic self-center">
                  +{customShifts.length - 5} more
                </span>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500">No custom shifts</p>
          )}
        </div>
      </div>
    </div>
  )
}