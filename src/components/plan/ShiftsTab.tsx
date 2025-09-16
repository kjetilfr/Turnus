// src/components/plan/ShiftsTab.tsx
'use client'

import { useState } from 'react'
import type { Shift } from '@/types/scheduler'
import ShiftForm from './ShiftForm'
import ShiftsList from './ShiftsList'

const SHIFT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
]

interface ShiftsTabProps {
  shifts: Shift[]
  onShiftSaved: (shift: Shift) => void
  onShiftDeleted: (shiftId: string) => void
}

export default function ShiftsTab({ shifts, onShiftSaved, onShiftDeleted }: ShiftsTabProps) {
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [shiftForm, setShiftForm] = useState({
    name: '',
    start_time: '',
    end_time: '',
    color: SHIFT_COLORS[0],
  })
  const [savingShift, setSavingShift] = useState(false)

  const resetShiftForm = () => {
    setShiftForm({
      name: '',
      start_time: '',
      end_time: '',
      color: SHIFT_COLORS[0],
    })
    setEditingShift(null)
    setShowShiftForm(false)
  }

  const openShiftForm = (shift?: Shift) => {
    if (shift) {
      setEditingShift(shift)
      setShiftForm({
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        color: shift.color,
      })
    } else {
      resetShiftForm()
      const usedColors = shifts.map(s => s.color)
      const availableColor = SHIFT_COLORS.find(color => !usedColors.includes(color)) || SHIFT_COLORS[0]
      setShiftForm({
        name: '',
        start_time: '',
        end_time: '',
        color: availableColor,
      })
    }
    setShowShiftForm(true)
  }

  const saveShift = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setSavingShift(true)
    try {
      // This would be handled by the parent component
      // For now, we'll just simulate the save
      const shiftData = {
        ...shiftForm,
        id: editingShift?.id || Date.now().toString(),
        plan_id: editingShift?.plan_id || '',
        created_at: editingShift?.created_at || new Date().toISOString(),
      }

      onShiftSaved(shiftData as Shift)
      resetShiftForm()
    } catch (error) {
      console.error('Error saving shift:', error)
      alert('Failed to save shift')
    } finally {
      setSavingShift(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Shift Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Shift Types
        </h2>
        <button
          onClick={() => openShiftForm()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Shift
        </button>
      </div>

      {/* Shift Form */}
      <ShiftForm
        showForm={showShiftForm}
        editingShift={editingShift}
        formData={shiftForm}
        setFormData={setShiftForm}
        onSubmit={saveShift}
        onCancel={resetShiftForm}
        saving={savingShift}
      />

      {/* Shifts List */}
      <ShiftsList
        shifts={shifts}
        onEditShift={openShiftForm}
        onDeleteShift={onShiftDeleted}
        onCreateShift={() => openShiftForm()}
      />
    </div>
  )
}