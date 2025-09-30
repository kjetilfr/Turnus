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
      <div className="space-y-6">
        {/* Default Shifts Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Default Shifts</h2>
            <p className="text-sm text-gray-600 mt-1">These shifts are created automatically and cannot be edited</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {defaultShifts.map((shift) => (
                  <tr key={shift.id} className="bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                          {shift.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {shift.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatShiftTime(shift.start_time)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatShiftTime(shift.end_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Custom Shifts Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Custom Shifts</h2>
            <p className="text-sm text-gray-600 mt-1">Create and manage your own shift types</p>
          </div>
          
          {customShifts.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <p>No custom shifts yet. Click "Create Shift" to add one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Time
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customShifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            {shift.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {shift.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatShiftTime(shift.start_time)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatShiftTime(shift.end_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setEditingShift(shift)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(shift.id)}
                            disabled={deleting === shift.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            {deleting === shift.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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