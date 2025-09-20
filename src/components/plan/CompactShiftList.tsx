// src/components/plan/CompactShiftList.tsx
'use client'

import type { Shift } from '@/types/scheduler'

interface CompactShiftListProps {
  shifts: Shift[]
  onEdit: (shift: Shift) => void
  onDelete: (shiftId: string) => void
  onCreateNew: () => void
}

// Helper function to check if a shift is an F shift (F1-F5)
function isFShift(shift: Shift): boolean {
  return /^f[1-5]$/i.test(shift.name.trim())
}

export default function CompactShiftList({ shifts, onEdit, onDelete, onCreateNew }: CompactShiftListProps) {
  const formatTime = (time: string) => {
    const parts = time.split(':')
    const hours = parts[0] || '00'
    const minutes = parts[1] || '00'
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
  }

  const calculateShiftDuration = (startTime: string, endTime: string) => {
    try {
      const parseTime = (timeStr: string) => {
        const parts = timeStr.split(':')
        const hours = parseInt(parts[0]) || 0
        const minutes = parseInt(parts[1]) || 0
        return { hours, minutes }
      }

      const start = parseTime(startTime)
      const end = parseTime(endTime)

      const startDate = new Date(2000, 0, 1, start.hours, start.minutes)
      let endDate = new Date(2000, 0, 1, end.hours, end.minutes)
      
      if (endDate <= startDate) {
        endDate = new Date(2000, 0, 2, end.hours, end.minutes)
      }
      
      const diffMs = endDate.getTime() - startDate.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      
      return isNaN(diffHours) ? 0 : diffHours
    } catch (error) {
      return 0
    }
  }

  const editableShifts = shifts.filter(shift => !isFShift(shift))
  const fShifts = shifts.filter(shift => isFShift(shift))

  if (shifts.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No shifts created</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Create your first shift to start building your schedule.
        </p>
        <div className="mt-4">
          <button
            onClick={onCreateNew}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
          >
            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Shift
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* F Shifts - Compact display */}
      {fShifts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center">
            <svg className="h-4 w-4 mr-1 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            F Shifts (System-managed)
          </h3>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
            <div className="grid grid-cols-5 gap-0">
              {fShifts
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((shift, index) => (
                <div 
                  key={shift.id} 
                  className={`px-2 py-1.5 text-center text-xs border-r border-gray-200 dark:border-gray-700 ${
                    index === fShifts.length - 1 ? 'border-r-0' : ''
                  } bg-blue-50 dark:bg-blue-900/20`}
                >
                  <div className="flex items-center justify-center">
                    <div
                      className="w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: shift.color }}
                    />
                    <span className="font-medium text-blue-900 dark:text-blue-200">{shift.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Shifts - Table format */}
      {editableShifts.length === 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Custom Shifts</h3>
            <button
              onClick={onCreateNew}
              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Custom
            </button>
          </div>
          <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No custom shifts created yet.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Custom Shifts</h3>
            <button
              onClick={onCreateNew}
              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <th className="px-2 py-1.5 text-left font-medium text-gray-900 dark:text-white">Name</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-900 dark:text-white">Times</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-900 dark:text-white">Duration</th>
                  <th className="px-2 py-1.5 text-center font-medium text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {editableShifts.map((shift, index) => {
                  const duration = calculateShiftDuration(shift.start_time, shift.end_time)
                  
                  return (
                    <tr key={shift.id} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-25 dark:hover:bg-gray-750 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750/50'}`}>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center space-x-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: shift.color }}
                          />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {shift.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="text-gray-600 dark:text-gray-300">
                          {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="text-gray-500 dark:text-gray-400">
                          {duration > 0 ? `${duration.toFixed(1)}h` : 'Invalid'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => onEdit(shift)}
                            className="text-gray-400 hover:text-blue-600 transition-colors duration-200"
                            title="Edit shift"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onDelete(shift.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors duration-200"
                            title="Delete shift"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}