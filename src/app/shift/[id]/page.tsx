'use client'

import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import type { Shift, Plan } from '@/types/scheduler'
import Link from 'next/link'

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

export default function ShiftPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const shiftId = params.id as string
  const supabase = createClient()

  const [shift, setShift] = useState<Shift | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [shiftForm, setShiftForm] = useState({
    name: '',
    start_time: '',
    end_time: '',
    color: SHIFT_COLORS[0],
  })

  useEffect(() => {
    if (user && shiftId) {
      fetchShiftData()
    }
  }, [user, shiftId])

  const fetchShiftData = async () => {
    try {
      setLoading(true)

      // Fetch shift with plan data
      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select(`
          *,
          plan:plans(*)
        `)
        .eq('id', shiftId)
        .single()

      if (shiftError) throw shiftError

      setShift(shiftData)
      setPlan(shiftData.plan)
      
      // Set form data
      setShiftForm({
        name: shiftData.name,
        start_time: shiftData.start_time,
        end_time: shiftData.end_time,
        color: shiftData.color,
      })

    } catch (error) {
      console.error('Error fetching shift data:', error)
      router.push('/')
    } finally {
      setLoading(false)
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shift) return

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('shifts')
        .update({
          name: shiftForm.name.trim(),
          start_time: shiftForm.start_time,
          end_time: shiftForm.end_time,
          color: shiftForm.color,
        })
        .eq('id', shift.id)
        .select()
        .single()

      if (error) throw error

      setShift(data)
      setEditing(false)
    } catch (error) {
      console.error('Error updating shift:', error)
      alert('Failed to update shift')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!shift || !confirm('Are you sure you want to delete this shift? This will also remove it from any rotations.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shift.id)

      if (error) throw error

      router.push(`/plan/${shift.plan_id}`)
    } catch (error) {
      console.error('Error deleting shift:', error)
      alert('Failed to delete shift')
    }
  }

  const cancelEdit = () => {
    if (shift) {
      setShiftForm({
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        color: shift.color,
      })
    }
    setEditing(false)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-xl text-gray-900 dark:text-white">Loading...</div>
      </div>
    )
  }

  if (!shift || !plan) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Shift not found</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-700">← Back to Plans</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow transition-colors duration-300 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href={`/plan/${plan.id}`}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
              >
                ← Back to {plan.name}
              </Link>
              <div className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: shift.color }}
                />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{shift.name}</h1>
              </div>
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

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Shift Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: shift.color }}
                  />
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{shift.name}</h1>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Part of <Link href={`/plan/${plan.id}`} className="text-blue-600 hover:text-blue-700">{plan.name}</Link>
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {!editing && (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Shift
                    </button>
                    <button
                      onClick={handleDelete}
                      className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-700 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Shift Details */}
          {editing ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Edit Shift Details</h2>
              </div>
              <form onSubmit={handleSave} className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 dark:text-white">
                      Shift Name
                    </label>
                    <input
                      type="text"
                      value={shiftForm.name}
                      onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors duration-200"
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
                          className={`w-10 h-10 rounded-full border-3 ${
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
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors duration-200"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Shift Information */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Shift Details</h2>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                      <p className="mt-1 text-lg text-gray-900 dark:text-white">{shift.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Start Time</label>
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                          {formatTime(shift.start_time)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">End Time</label>
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                          {formatTime(shift.end_time)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Duration</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                        {calculateShiftDuration(shift.start_time, shift.end_time).toFixed(1)} hours
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Color</label>
                      <div className="mt-2 flex items-center space-x-2">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: shift.color }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">{shift.color}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Quick Stats</h2>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {calculateShiftDuration(shift.start_time, shift.end_time).toFixed(1)}h
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Shift duration</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Time range</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {shift.start_time > shift.end_time ? 'Overnight' : 'Same day'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Shift type</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}