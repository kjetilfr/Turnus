'use client'

import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import type { Plan, Shift, Rotation } from '@/types/scheduler'
import Link from 'next/link'

const DAYS_OF_WEEK = [
  { id: 0, name: 'Sunday', short: 'Sun' },
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
]

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

export default function PlanPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const planId = params.id as string
  const supabase = createClient()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'shifts' | 'rotation'>('shifts')

  // Shift form state
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [shiftForm, setShiftForm] = useState({
    name: '',
    start_time: '',
    end_time: '',
    color: SHIFT_COLORS[0],
  })
  const [savingShift, setSavingShift] = useState(false)

  useEffect(() => {
    if (user && planId) {
      fetchPlanData()
    }
  }, [user, planId])

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
    }
    setShowShiftForm(true)
  }

  const saveShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plan) return

    setSavingShift(true)
    try {
      const shiftData = {
        name: shiftForm.name.trim(),
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        color: shiftForm.color,
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

      resetShiftForm()
    } catch (error) {
      console.error('Error saving shift:', error)
      alert('Failed to save shift')
    } finally {
      setSavingShift(false)
    }
  }

  const deleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) {
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

  const updateRotation = async (dayOfWeek: number, shiftId: string | null) => {
    if (!plan) return

    try {
      const existingRotation = rotations.find(r => r.day_of_week === dayOfWeek)

      if (existingRotation) {
        const { data, error } = await supabase
          .from('rotations')
          .update({ shift_id: shiftId })
          .eq('id', existingRotation.id)
          .select(`*, shift:shifts(*)`)
          .single()

        if (error) throw error
        setRotations(rotations.map(r => r.id === existingRotation.id ? data : r))
      } else if (shiftId) {
        const { data, error } = await supabase
          .from('rotations')
          .insert([{
            plan_id: plan.id,
            day_of_week: dayOfWeek,
            shift_id: shiftId,
          }])
          .select(`*, shift:shifts(*)`)
          .single()

        if (error) throw error
        setRotations([...rotations, data])
      }
    } catch (error) {
      console.error('Error updating rotation:', error)
      alert('Failed to update rotation')
    }
  }

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

  const getRotationForDay = (dayOfWeek: number) => {
    return rotations.find(r => r.day_of_week === dayOfWeek)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <nav className="bg-white dark:bg-gray-800 shadow transition-colors duration-300 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
              >
                ← Back to Plans
              </Link>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{plan.name}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {user?.email?.split('@')[0]}
              </span>
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{plan.name}</h1>
            {plan.description && (
              <p className="text-gray-600 dark:text-gray-300 mt-1">{plan.description}</p>
            )}
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('shifts')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'shifts'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                } transition-colors duration-200`}
              >
                Shifts ({shifts.length})
              </button>
              <button
                onClick={() => setActiveTab('rotation')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'rotation'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                } transition-colors duration-200`}
              >
                Weekly Rotation
              </button>
            </nav>
          </div>

          {/* Rest of the component continues... */}
        </div>
      </main>
    </div>
  )
}