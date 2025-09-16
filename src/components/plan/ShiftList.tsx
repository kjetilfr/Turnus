'use client'

import type { Shift } from '@/types/scheduler'

interface ShiftListProps {
  shifts: Shift[]
  onEdit: (shift: Shift) => void
  onDelete: (shiftId: string) => void
  onCreateNew: () => void
}

export default function ShiftList({ shifts, onEdit, onDelete, onCreateNew }: ShiftListProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const calculateShiftDuration = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}:00`)
    let end = new Date(`2000-01-01T${endTime}:00`)
    
    if (end <= start) {
      end = new Date(`2000-01-02T${endTime}:00`)
    }
    
    const diffMs = end.getTime() - start.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return diffHours
  }

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {shifts.map((shift) => (
        <div key={shift.id} className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: shift.color }}
                />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{shift.name}</h3>
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
                {calculateShiftDuration(shift.start_time, shift.end_time).toFixed(1)} hours
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}