// src/components/plan/ShiftList.tsx
'use client'

import type { Shift } from '@/types/scheduler'

interface ShiftListProps {
  shifts: Shift[]
  onEdit: (shift: Shift) => void
  onDelete: (shiftId: string) => void
  onCreateNew: () => void
}

// Helper function to check if a shift is an F shift (F1-F5)
function isFShift(shift: Shift): boolean {
  return /^f[1-5]$/i.test(shift.name.trim())
}

export default function ShiftList({ shifts, onEdit, onDelete, onCreateNew }: ShiftListProps) {
  const formatTime = (time: string) => {
    // Handle both "HH:MM" and "HH:MM:SS" formats
    const parts = time.split(':')
    const hours = parts[0] || '00'
    const minutes = parts[1] || '00'
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
  }

  const calculateShiftDuration = (startTime: string, endTime: string) => {
    try {
      // Parse time strings - handle both "HH:MM" and "HH:MM:SS" formats
      const parseTime = (timeStr: string) => {
        const parts = timeStr.split(':')
        const hours = parseInt(parts[0]) || 0
        const minutes = parseInt(parts[1]) || 0
        return { hours, minutes }
      }

      const start = parseTime(startTime)
      const end = parseTime(endTime)

      // Create date objects for calculation
      const startDate = new Date(2000, 0, 1, start.hours, start.minutes)
      let endDate = new Date(2000, 0, 1, end.hours, end.minutes)
      
      // Handle overnight shifts (end time is before start time)
      if (endDate <= startDate) {
        endDate = new Date(2000, 0, 2, end.hours, end.minutes) // Next day
      }
      
      const diffMs = endDate.getTime() - startDate.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      
      return isNaN(diffHours) ? 0 : diffHours
    } catch (error) {
      console.error('Error calculating shift duration:', error, { startTime, endTime })
      return 0
    }
  }

  // Filter out F shifts - they shouldn't be editable
  const editableShifts = shifts.filter(shift => !isFShift(shift))
  const fShifts = shifts.filter(shift => isFShift(shift))

  if (shifts.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No shifts created</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create your first shift to start building your schedule.
        </p>
        <div className="mt-6">
          <button
            onClick={onCreateNew}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Shift
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* F Shifts (Read-only) */}
      {fShifts.length > 0 && (
        <div>
          <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <svg className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            F Shifts (System-managed)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {fShifts
              .sort((a, b) => a.name.localeCompare(b.name)) // F1, F2, F3, F4, F5
              .map((shift) => (
              <div key={shift.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors duration-300 opacity-75">
                <div className="px-3 py-2">
                  <div className="flex items-center justify-center mb-1">
                    <div
                      className="w-3 h-3 rounded-full mr-2 opacity-60"
                      style={{ backgroundColor: shift.color }}
                    />
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">{shift.name}</h4>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Times not used
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editable Shifts */}
      {editableShifts.length === 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-medium text-gray-900 dark:text-white">Custom Shifts</h3>
          </div>
          <div className="text-center py-8">
            <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No custom shifts</h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create custom shifts with specific times for your schedule.
            </p>
            <div className="mt-4">
              <button
                onClick={onCreateNew}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Custom Shift
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-medium text-gray-900 dark:text-white">Custom Shifts</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {editableShifts.map((shift) => {
              const duration = calculateShiftDuration(shift.start_time, shift.end_time)
              
              return (
                <div key={shift.id} className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300 hover:shadow-md">
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: shift.color }}
                        />
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">{shift.name}</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEdit(shift)}
                          className="text-gray-400 hover:text-blue-600 transition-colors duration-200"
                          title="Edit shift"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onDelete(shift.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors duration-200"
                          title="Delete shift"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      <p className="font-medium">
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </p>
                      <p className="text-xs mt-1">
                        {duration > 0 ? `${duration.toFixed(1)} hours` : 'Invalid time range'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}