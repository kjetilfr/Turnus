// src/app/plan/[id]/page.tsx - Updated with Tests Tab
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
import TestsTab from '@/components/plan/TestsTab'

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

  // State - Updated to include tests tab
  const [plan, setPlan] = useState<Plan | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'shifts' | 'rotation' | 'tests'>('shifts')
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [savingShift, setSavingShift] = useState(false)

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

      <main className="max-w-7xl mx-auto py-6 sm