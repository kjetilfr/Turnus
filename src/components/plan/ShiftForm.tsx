// src/components/plan/ShiftForm.tsx
'use client'

import { useState } from 'react'
import { SHIFT_COLORS } from '@/lib/constants'
import type { Shift } from '@/types/scheduler'

interface ShiftFormProps {
  shifts: Shift[]
  editingShift: Shift | null
  onSave: (formData: ShiftFormData) => Promise<void>
  onCancel: () => void
  saving: boolean
}

export interface ShiftFormData {
  name: string
  start_time: string
  end_time: string
  color: string
}

// Helper function to check if a shift is an F shift (F1-F5)
function isFShift(shift: Shift | null): boolean {
  if (!shift) return false
  return /^f[1-5]$/i.test(shift.name.trim())
}

export default function ShiftForm({ 
  shifts, 
  editingShift, 
  onSave, 
  onCancel, 
  saving 
}: ShiftFormProps) {
  const [formData, setFormData] = useState<ShiftFormData>(() => {
    if (editingShift) {
      return {
        name: editingShift.name,
        start_time: editingShift.start_time,
        end_time: editingShift.end_time,
        color: editingShift.color,
      }
    }
    
    const usedColors = shifts.map(s => s.color)
    const availableColor = SHIFT_COLORS.find(color => !usedColors.includes(color)) || SHIFT_COLORS[0]
    
    return {
      name: '',
      start_time: '',
      end_time: '',
      color: availableColor,
    }
  })

  const isEditingFShift = isFShift(editingShift)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditingFShift) {
      // Don't allow saving F shifts
      return
    }
    await onSave(formData)
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {editingShift ? 'Edit Shift' : 'Create New Shift'}
            {isEditingFShift && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                (F Shifts are system-managed)
              </span>
            )}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {isEditingFShift && (
        <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              F Shifts (F1-F5) are managed by the system. Only the color can be changed. Times are not used for F shifts.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-white">
              Shift Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isEditingFShift}
              className={`mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 ${
                isEditingFShift ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
              }`}
              placeholder="e.g., Day Shift, Night Shift"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white">
              Start Time
              {isEditingFShift && <span className="text-xs text-gray-500 ml-1">(not used)</span>}
            </label>
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              disabled={isEditingFShift}
              className={`mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 ${
                isEditingFShift ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
              }`}
              required={!isEditingFShift}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white">
              End Time
              {isEditingFShift && <span className="text-xs text-gray-500 ml-1">(not used)</span>}
            </label>
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              disabled={isEditingFShift}
              className={`mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200 ${
                isEditingFShift ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
              }`}
              required={!isEditingFShift}
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
              Color
            </label>
            <div className="flex flex-wrap gap-3">
              {SHIFT_COLORS.map((color) => {
                const isSelected = formData.color === color
                const isTransparent = color === 'none'
                
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => !isEditingFShift && setFormData({ ...formData, color })}
                    disabled={isEditingFShift}
                    className={`w-10 h-10 rounded-full border-2 ${
                      isSelected
                        ? 'border-gray-900 dark:border-white scale-110 ring-2 ring-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    } transition-all duration-200 ${
                      isEditingFShift ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                    } relative overflow-hidden`}
                    style={{ backgroundColor: color === 'none' ? 'transparent' : color }}
                    title={isTransparent ? 'No color (default)' : `Color: ${color}`}
                  >
                    {/* Removed the ∅ symbol for cleaner look */}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              No color shifts appear with no background color.
            </p>
          </div>
        </div>
        
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Cancel
          </button>
          {!isEditingFShift && (
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
            >
              {saving ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}