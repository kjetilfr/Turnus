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

  const updateRotation = async (dayOfWeek: number, shiftId: string | null) => {
    if (!plan) return

    try {
      const existingRotation = rotations.find(r => r.day_of_week === dayOfWeek)

      if (existingRotation) {
        // Update existing rotation
        const { data, error } = await supabase
          .from('rotations')
          .update({ shift_id: shiftId })
          .eq('id', existingRotation.id)
          .select(`*, shift:shifts(*)`)
          .single()

        if (error) throw error
        setRotations(rotations.map(r => r.id === existingRotation.id ? data : r))
      } else if (shiftId) {
        // Create new rotation
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

          {/* Tab Navigation */}
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

          {/* Shifts Tab */}
          {activeTab === 'shifts' && (
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
              {showShiftForm && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {editingShift ? 'Edit Shift' : 'Create New Shift'}
                      </h3>
                      <button
                        onClick={resetShiftForm}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <form onSubmit={saveShift} className="px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                          Shift Name
                        </label>
                        <input
                          type="text"
                          value={shiftForm.name}
                          onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                          placeholder="e.g., Day Shift, Night Shift"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={shiftForm.start_time}
                          onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={shiftForm.end_time}
                          onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                          Color
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {SHIFT_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setShiftForm({ ...shiftForm, color })}
                              className={`w-8 h-8 rounded-full border-2 ${
                                shiftForm.color === color
                                  ? 'border-gray-900 dark:border-white scale-110'
                                  : 'border-gray-300 dark:border-gray-600'
                              } transition-all duration-200`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-end space-x-3">
                      <button
                        type="button"
                        onClick={resetShiftForm}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingShift}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
                      >
                        {savingShift ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Shifts List */}
              {shifts.length === 0 ? (
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
                      onClick={() => openShiftForm()}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Your First Shift
                    </button>
                  </div>
                </div>
              ) : (
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
                              onClick={() => openShiftForm(shift)}
                              className="text-gray-400 hover:text-blue-600 transition-colors duration-200"
                              title="Edit shift"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteShift(shift.id)}
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
              )}
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
                {shifts.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Create shifts first to set up rotations
                  </p>
                )}
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
                  {/* Multi-Week Schedule Grid */}
                  <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schedule Grid</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Click on any day to assign a shift
                      </p>
                    </div>
                    <div className="p-6 overflow-x-auto">
                      <div className="min-w-full">
                        {/* Week headers and grid */}
                        {Array.from({ length: plan.duration_weeks }, (_, weekIndex) => (
                          <div key={weekIndex} className="mb-8 last:mb-0">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                              Week {weekIndex + 1}
                            </h4>
                            <div className="grid grid-cols-7 gap-2">
                              {DAYS_OF_WEEK.map((day) => {
                                const dayRotation = getRotationForDay(day.id)
                                const assignedShift = dayRotation?.shift
                                const isSunday = day.id === 0
                                
                                return (
                                  <div
                                    key={`week-${weekIndex}-day-${day.id}`}
                                    className={`text-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-200 ${
                                      isSunday 
                                        ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' 
                                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                                    onClick={() => {
                                      const currentShiftId = dayRotation?.shift_id || ''
                                      const shiftIndex = shifts.findIndex(s => s.id === currentShiftId)
                                      const nextShiftIndex = (shiftIndex + 1) % (shifts.length + 1)
                                      const nextShiftId = nextShiftIndex === 0 ? null : shifts[nextShiftIndex - 1].id
                                      updateRotation(day.id, nextShiftId)
                                    }}
                                  >
                                    <div className={`text-xs font-medium mb-2 ${
                                      isSunday 
                                        ? 'text-red-700 dark:text-red-300' 
                                        : 'text-gray-900 dark:text-white'
                                    }`}>
                                      {day.short}
                                    </div>
                                    {assignedShift ? (
                                      <div className="space-y-1">
                                        <div
                                          className="w-4 h-4 rounded-full mx-auto"
                                          style={{ backgroundColor: assignedShift.color }}
                                        />
                                        <div className={`text-xs font-medium ${
                                          isSunday 
                                            ? 'text-red-800 dark:text-red-200' 
                                            : 'text-gray-900 dark:text-white'
                                        }`}>
                                          {assignedShift.name}
                                        </div>
                                        <div className={`text-xs ${
                                          isSunday 
                                            ? 'text-red-600 dark:text-red-400' 
                                            : 'text-gray-600 dark:text-gray-400'
                                        }`}>
                                          {formatTime(assignedShift.start_time)}
                                        </div>
                                        <div className={`text-xs ${
                                          isSunday 
                                            ? 'text-red-600 dark:text-red-400' 
                                            : 'text-gray-600 dark:text-gray-400'
                                        }`}>
                                          {formatTime(assignedShift.end_time)}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className={`text-xs ${
                                        isSunday 
                                          ? 'text-red-500 dark:text-red-400' 
                                          : 'text-gray-400 dark:text-gray-500'
                                      }`}>
                                        No shift
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quick Assignment Panel */}
                  <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Quick Assignment</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Set the same shift for all weeks of a specific day
                      </p>
                    </div>
                    <div className="p-6">
                      <div className="space-y-4">
                        {DAYS_OF_WEEK.map((day) => {
                          const dayRotation = getRotationForDay(day.id)
                          const assignedShift = dayRotation?.shift
                          const isSunday = day.id === 0
                          
                          return (
                            <div key={day.id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                              <div className="flex items-center space-x-3">
                                <span className={`w-20 text-sm font-medium ${
                                  isSunday 
                                    ? 'text-red-700 dark:text-red-300' 
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                  {day.name}
                                </span>
                                {assignedShift && (
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: assignedShift.color }}
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                      {assignedShift.name}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      ({formatTime(assignedShift.start_time)} - {formatTime(assignedShift.end_time)})
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <select
                                  value={dayRotation?.shift_id || ''}
                                  onChange={(e) => updateRotation(day.id, e.target.value || null)}
                                  className="block w-48 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                                >
                                  <option value="">No shift</option>
                                  {shifts.map((shift) => (
                                    <option key={shift.id} value={shift.id}>
                                      {shift.name} ({formatTime(shift.start_time)} - {formatTime(shift.end_time)})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Schedule Statistics */}
                  <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Schedule Statistics</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {rotations.filter(r => r.shift_id).length}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Days with shifts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {(rotations
                              .filter(r => r.shift && r.shift_id)
                              .reduce((total, r) => {
                                if (r.shift) {
                                  return total + calculateShiftDuration(r.shift.start_time, r.shift.end_time)
                                }
                                return total
                              }, 0) * plan.duration_weeks)
                              .toFixed(1)}h
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Total plan hours</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {(7 - rotations.filter(r => r.shift_id).length) * plan.duration_weeks}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Total days off</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {((rotations
                              .filter(r => r.shift && r.shift_id)
                              .reduce((total, r) => {
                                if (r.shift) {
                                  return total + calculateShiftDuration(r.shift.start_time, r.shift.end_time)
                                }
                                return total
                              }, 0) * plan.duration_weeks) / plan.duration_weeks)
                              .toFixed(1)}h
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Avg weekly hours</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}