// src/app/page.tsx
'use client'

import { useAuth } from '@/lib/auth-context'
import { useDarkMode } from '@/lib/dark-mode-context'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Plan } from '@/types/scheduler'
import { DEFAULT_SHIFTS } from '@/types/scheduler'

// Import new components
import LoadingScreen from '@/components/ui/LoadingScreen'
import PublicNavigation from '@/components/home/PublicNavigation'
import AuthenticatedNavigation from '@/components/home/AuthenticatedNavigation'
import HeroSection from '@/components/home/HeroSection'
import FeaturesSection from '@/components/home/FeaturesSection'
import CreatePlanForm from '@/components/home/CreatePlanForm'
import PlansGrid from '@/components/home/PlansGrid'

export default function HomePage() {
  const { user, loading } = useAuth()
  const { mounted } = useDarkMode()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanDescription, setNewPlanDescription] = useState('')
  const [newPlanType, setNewPlanType] = useState<'main' | 'helping'>('main') // NEW
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const supabase = createClient()
  const [newPlanDuration, setNewPlanDuration] = useState(1)
  const [newPlanF1TimeOff, setNewPlanF1TimeOff] = useState(35)

  useEffect(() => {
    if (user) {
      fetchPlans()
    }
  }, [user])

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPlans(data || [])
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoadingPlans(false)
    }
  }

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newPlanName.trim()) return

    setCreatingPlan(true)
    try {
      // Create the plan
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .insert([
          {
            name: newPlanName.trim(),
            description: newPlanDescription.trim() || null,
            duration_weeks: newPlanDuration,
            f1_time_off: newPlanType === 'main' ? newPlanF1TimeOff : null, // Only for main plans
            plan_type: newPlanType, // NEW: Add plan type
            user_id: user.id,
          },
        ])
        .select()
        .single()

      if (planError) throw planError

      // Only create default F1-F5 shifts for MAIN plans
      if (newPlanType === 'main') {
        const defaultShiftsData = DEFAULT_SHIFTS.map(shift => ({
          ...shift,
          plan_id: planData.id,
        }))

        const { error: shiftsError } = await supabase
          .from('shifts')
          .insert(defaultShiftsData)

        if (shiftsError) {
          console.error('Error creating default shifts:', shiftsError)
          // Plan was created successfully, but shifts failed - continue anyway
        }
      }

      setPlans([planData, ...plans])
      setNewPlanName('')
      setNewPlanDescription('')
      setNewPlanType('main')
      setNewPlanDuration(1)
      setNewPlanF1TimeOff(35)
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating plan:', error)
      alert('Failed to create plan')
    } finally {
      setCreatingPlan(false)
    }
  }

  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This will also delete all shifts and rotations.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId)

      if (error) throw error

      setPlans(plans.filter(plan => plan.id !== planId))
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete plan')
    }
  }

  // Show loading while components mount
  if (loading || !mounted) {
    return <LoadingScreen />
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <PublicNavigation />
        <main>
          <HeroSection />
          <FeaturesSection />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <AuthenticatedNavigation userEmail={user.email} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Schedule Plans</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Create and manage your nursing schedules
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Plan
              </button>
            </div>
          </div>

          {/* Create Plan Form */}
          {showCreateForm && (
            <CreatePlanForm
              newPlanName={newPlanName}
              setNewPlanName={setNewPlanName}
              newPlanDescription={newPlanDescription}
              setNewPlanDescription={setNewPlanDescription}
              newPlanDuration={newPlanDuration}
              setNewPlanDuration={setNewPlanDuration}
              newPlanF1TimeOff={newPlanF1TimeOff}
              setNewPlanF1TimeOff={setNewPlanF1TimeOff}
              newPlanType={newPlanType} // NEW
              setNewPlanType={setNewPlanType} // NEW
              onSubmit={createPlan}
              onCancel={() => setShowCreateForm(false)}
              creating={creatingPlan}
            />
          )}

          {/* Plans List */}
          {loadingPlans ? (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400">Loading plans...</div>
            </div>
          ) : (
            <PlansGrid
              plans={plans}
              onDeletePlan={deletePlan}
              onShowCreateForm={() => setShowCreateForm(true)}
            />
          )}
        </div>
      </main>
    </div>
  )
}