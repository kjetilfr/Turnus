// src/components/shift/ShiftsList.tsx
'use client'

import { Shift, formatShiftTime } from '@/types/shift'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import EditShiftModal from './EditShiftModal'

interface ShiftsListProps {
  shifts: Shift[]
  planId: string
}

export default function ShiftsList({ shifts, planId }: ShiftsListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedShift, setExpandedShift] = useState<string | null>(null)

  const defaultShifts = shifts.filter(s => s.is_default)
  const customShifts = shifts.filter(s => !s.is_default)

  const handleDelete = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) {
      return
    }

    setDeleting(shiftId)
    
    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error('Error deleting shift:', error)
      alert('Failed to delete shift')
    } finally {
      setDeleting(null)
    }
  }

  const toggleExpand = (shiftId: string) => {
    setExpandedShift(expandedShift === shiftId ? null : shiftId)
  }

  if (shifts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <div className="text-6xl mb-4">⏰</div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">No Shifts Found</h3>
        <p className="text-gray-600">
          Default shifts should be created automatically. Try refreshing the page.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Default Shifts Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Default Shifts</h2>
            <p className="text-sm text-gray-600 mt-1">F1-F5 shifts (cannot be edited)</p>
          </div>
          <div className="divide-y divide-gray-200">
            {defaultShifts.map((shift) => (
              <div key={shift.id} className="bg-gray-50">
                <div className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-gray-200 text-gray-800">
                          {shift.name}
                        </span>
                        {shift.description && (
                          <button
                            onClick={() => toggleExpand(shift.id)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            {expandedShift === shift.id ? 'Hide details' : 'Show details'}
                          </button>
                        )}
                      </div>
                      {shift.description && expandedShift === shift.id && (
                        <div className="mt-3 p-3 bg-white rounded border border-gray-200 text-sm text-gray-700 leading-relaxed">
                          {shift.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {defaultShifts.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">
                No default shifts found
              </div>
            )}
          </div>
        </div>

        {/* Custom Shifts Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Custom Shifts</h2>
            <p className="text-sm text-gray-600 mt-1">Your custom shift types</p>
          </div>
          <div className="divide-y divide-gray-200">
            {customShifts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">⏰</div>
                <p className="text-gray-600 text-sm mb-4">
                  No custom shifts yet.
                </p>
                <p className="text-gray-500 text-xs">
                  Click &quot;Create Shift&quot; or &quot;Import Shifts&quot; to add custom shifts.
                </p>
              </div>
            ) : (
              customShifts.map((shift) => (
                <div key={shift.id} className="hover:bg-gray-50 transition-colors">
                  <div className="px-6 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800">
                            {shift.name}
                          </span>
                          <span className="text-xs font-medium text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-300">
                            {formatShiftTime(shift.start_time)} - {formatShiftTime(shift.end_time)}
                          </span>
                        </div>
                        {shift.description && (
                          <div className="text-sm text-gray-600 mt-1">
                            {shift.description}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setEditingShift(shift)}
                          className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(shift.id)}
                          disabled={deleting === shift.id}
                          className="text-sm text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                        >
                          {deleting === shift.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingShift && (
        <EditShiftModal
          shift={editingShift}
          onClose={() => setEditingShift(null)}
          onSuccess={() => {
            setEditingShift(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}