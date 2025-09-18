// src/app/plan/[id]/page.tsx - Updated handleEditShift function
'use client'

import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { Plan, Shift, Rotation } from '@/types/scheduler'

// Import the updated components
import PlanNavigation from '@/components/plan/PlanNavigation'
import PlanTabs from '@/components/plan/PlanTabs'
import ShiftForm, { type ShiftFormData } from '@/components/plan/ShiftForm'
import ShiftList from '@/components/plan/ShiftList'
import RotationGrid from '@/components/plan/RotationGrid'
import ScheduleStatistics from '@/components/plan/ScheduleStatistics'
import TestModal from '@/components/plan/TestModal'

// Helper function to check if a shift is an F shift (F1-F5)
function isFShift(shift: Shift): boolean {
  return /^f[1-5]$/i.test(shift.name.trim())
}

export default function PlanPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const planId = params.id as string
  const supabase = createClient()

  // State
  const [plan, setPlan] = useState<Plan | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'shifts' | 'rotation'>('shifts')
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [savingShift, setSavingShift] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)

  // Effects
  useEffect(() => {
    if (user && planId) {
      fetchPlanData()
    }
  }, [user, planId])

  // Data fetching
  const fetchPlanData = async () => {
    try {
      setLoading(true)

      // Fetch plan
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single()

      if (planError) throw planError
      setPlan(planData)

      // Fetch shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: true })

      if (shiftsError) throw shiftsError
      setShifts(shiftsData || [])

      // Fetch rotations with shift data
      const { data: rotationsData, error: rotationsError } = await supabase
        .from('rotations')
        .select(`
          *,
          shift:shifts(*)
        `)
        .eq('plan_id', planId)

      if (rotationsError) throw rotationsError
      setRotations(rotationsData || [])

    } catch (error) {
      console.error('Error fetching plan data:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  // Shift handlers
  const handleCreateShift = () => {
    setEditingShift(null)
    setShowShiftForm(true)
  }

  const handleEditShift = (shift: Shift) => {
    // Check if it's an F shift and prevent editing with a message
    if (isFShift(shift)) {
      alert('F Shifts (F1-F5) are system-managed and cannot be edited. Only colors can be changed through the interface.')
      return
    }
    
    setEditingShift(shift)
    setShowShiftForm(true)
  }

  const handleCancelShiftForm = () => {
    setEditingShift(null)
    setShowShiftForm(false)
  }

  const handleSaveShift = async (formData: ShiftFormData) => {
    if (!plan) return

    // Prevent saving F shifts
    if (editingShift && isFShift(editingShift)) {
      alert('F Shifts cannot be modified')
      return
    }

    setSavingShift(true)
    try {
      const shiftData = {
        name: formData.name.trim(),
        start_time: formData.start_time,
        end_time: formData.end_time,
        color: formData.color,
        plan_id: plan.id,
      }

      if (editingShift) {
        // Update existing shift
        const { data, error } = await supabase
          .from('shifts')
          .update(shiftData)
          .eq('id', editingShift.id)
          .select()
          .single()

        if (error) throw error
        setShifts(shifts.map(s => s.id === editingShift.id ? data : s))
      } else {
        // Create new shift
        const { data, error } = await supabase
          .from('shifts')
          .insert([shiftData])
          .select()
          .single()

        if (error) throw error
        setShifts([...shifts, data])
      }

      handleCancelShiftForm()
    } catch (error) {
      console.error('Error saving shift:', error)
      alert('Failed to save shift')
    } finally {
      setSavingShift(false)
    }
  }

  const handleDeleteShift = async (shiftId: string) => {
    // Find the shift to check if it's an F shift
    const shift = shifts.find(s => s.id === shiftId)
    if (shift && isFShift(shift)) {
      alert('F Shifts (F1-F5) are system-managed and cannot be deleted.')
      return
    }

    if (!confirm('Are you sure you want to delete this shift? This will also remove it from any rotations.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId)

      if (error) throw error

      setShifts(shifts.filter(s => s.id !== shiftId))
      setRotations(rotations.map(r => 
        r.shift_id === shiftId ? { ...r, shift_id: null, shift: undefined } : r
      ))
    } catch (error) {
      console.error('Error deleting shift:', error)
      alert('Failed to delete shift')
    }
  }

// Updated rotation handler for week-specific assignments
  const handleRotationUpdate = async (weekIndex: number, dayOfWeek: number, shiftId: string | null) => {
    if (!plan) return

    console.log(`handleRotationUpdate called: Week ${weekIndex + 1}, Day ${dayOfWeek}, ShiftId: ${shiftId || 'null'}`)

    try {
      const existingRotation = rotations.find(r => 
        r.week_index === weekIndex && r.day_of_week === dayOfWeek
      )

      if (existingRotation) {
        console.log(`Updating existing rotation ${existingRotation.id}`)
        // Update existing rotation
        const { data, error } = await supabase
          .from('rotations')
          .update({ shift_id: shiftId })
          .eq('id', existingRotation.id)
          .select(`
            *,
            shift:shifts(*)
          `)
          .single()

        if (error) {
          console.error('Error updating rotation:', error)
          throw error
        }
        
        console.log('Rotation updated successfully:', data)
        setRotations(rotations.map(r => r.id === existingRotation.id ? data : r))
      } else if (shiftId) {
        console.log('Creating new rotation')
        // Create new rotation
        const { data, error } = await supabase
          .from('rotations')
          .insert([{
            plan_id: plan.id,
            week_index: weekIndex,
            day_of_week: dayOfWeek,
            shift_id: shiftId,
          }])
          .select(`
            *,
            shift:shifts(*)
          `)
          .single()

        if (error) {
          console.error('Error creating rotation:', error)
          throw error
        }
        
        console.log('New rotation created successfully:', data)
        setRotations([...rotations, data])
      } else {
        console.log('No existing rotation and no shift ID provided - nothing to do')
      }
    } catch (error) {
      console.error('Error in handleRotationUpdate:', error)
      
      // Provide more specific error messages with proper error type checking
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (errorMessage.includes('violates foreign key constraint')) {
        alert('Error: Invalid shift or plan reference. Please refresh the page and try again.')
      } else if (errorMessage.includes('duplicate key')) {
        alert('Error: A rotation already exists for this time slot. Please refresh the page.')
      } else {
        alert(`Failed to update rotation: ${errorMessage || 'Unknown error'}`)
      }
      
      // Re-fetch data to ensure consistency
      await fetchPlanData()
    }
  }

  // Loading states
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Loading...</div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Plan not found</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-700">← Back to Plans</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <PlanNavigation plan={plan} userEmail={user?.email} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{plan.name}</h1>
            {plan.description && (
              <p className="text-gray-600 dark:text-gray-300 mt-1">{plan.description}</p>
            )}
          </div>

          {/* Tab Navigation */}
          <PlanTabs 
            activeTab={activeTab}
            shiftsCount={shifts.length}
            onTabChange={setActiveTab}
          />

          {/* Shifts Tab */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              {/* Add Shift Button */}
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Shift Types
                </h2>
                <button
                  onClick={handleCreateShift}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Shift
                </button>
              </div>

              {/* Shift Form */}
              {showShiftForm && (
                <ShiftForm
                  shifts={shifts}
                  editingShift={editingShift}
                  onSave={handleSaveShift}
                  onCancel={handleCancelShiftForm}
                  saving={savingShift}
                />
              )}

              {/* Shifts List */}
              <ShiftList
                shifts={shifts}
                onEdit={handleEditShift}
                onDelete={handleDeleteShift}
                onCreateNew={handleCreateShift}
              />
            </div>
          )}

          {/* Rotation Tab */}
          {activeTab === 'rotation' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {plan.duration_weeks > 1 ? `${plan.duration_weeks}-Week Rotation` : 'Weekly Rotation'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Plan duration: {plan.duration_weeks} week{plan.duration_weeks !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  {shifts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Create shifts first to set up rotations
                    </p>
                  ) : (
                    <button
                      onClick={() => setShowTestModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Test
                    </button>
                  )}
                </div>
              </div>

              {shifts.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No shifts available</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    You need to create shifts before setting up rotations.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => setActiveTab('shifts')}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    >
                      Go to Shifts
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Updated Schedule Grid with drag and drop */}
                  <RotationGrid
                    plan={plan}
                    shifts={shifts}
                    rotations={rotations}
                    onRotationUpdate={handleRotationUpdate}
                  />

                  {/* Statistics */}
                  <ScheduleStatistics
                    plan={plan}
                    rotations={rotations}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Test Modal */}
      <TestModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        plan={plan}
        shifts={shifts}
        rotations={rotations}
      />
    </div>
  )
}