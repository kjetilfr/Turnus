// src/app/plans/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import RotationGrid from '@/components/rotation/RotationGrid'
import ShiftSummary from '@/components/rotation/ShiftSummary'
import NightShiftInfoCard from '@/components/rotation/NightShiftInfoCard'
import Link from 'next/link'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PlanDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch the plan
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (planError || !plan) {
    notFound()
  }

  // Fetch all rotations for this plan
  const { data: rotations, error: rotationsError } = await supabase
    .from('rotations')
    .select('*')
    .eq('plan_id', id)
    .order('week_index')
    .order('day_of_week')

  if (rotationsError) {
    console.error('Error fetching rotations:', rotationsError)
  }

  // Fetch all shifts for this plan
  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('*')
    .eq('plan_id', id)
    .order('is_default', { ascending: false })
    .order('name')

  if (shiftsError) {
    console.error('Error fetching shifts:', shiftsError)
  }

  const defaultShifts = shifts?.filter(s => s.is_default) || []
  const customShifts = shifts?.filter(s => !s.is_default) || []

  // Fetch base plan if this is a helping plan
  let basePlan = null
  if (plan.base_plan_id) {
    const { data } = await supabase
      .from('plans')
      .select('name')
      .eq('id', plan.base_plan_id)
      .single()
    basePlan = data
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Dashboard
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
            </div>
            <Link
              href={`/plans/${id}/shifts`}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              Manage Shifts
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Plan Info Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Details</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Duration</div>
                <div className="text-lg font-semibold text-gray-900">
                  {plan.duration_weeks} {plan.duration_weeks === 1 ? 'week' : 'weeks'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Type</div>
                <div className="text-lg font-semibold text-gray-900 capitalize">{plan.type}</div>
              </div>
              {basePlan && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Based On</div>
                  <div className="text-lg font-semibold text-gray-900">{basePlan.name}</div>
                </div>
              )}
            </div>
            {plan.description && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Description</div>
                <div className="text-gray-900">{plan.description}</div>
              </div>
            )}
          </div>

          {/* Shifts Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Shift Types</h2>
              <Link
                href={`/plans/${id}/shifts`}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Manage shifts →
              </Link>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Default Shifts */}
              <div>
                <h3 className="text-xs font-medium text-gray-700 mb-2">Default Shifts</h3>
                <div className="flex flex-wrap gap-1.5">
                  {defaultShifts.length > 0 ? (
                    defaultShifts.map((shift) => (
                      <span 
                        key={shift.id}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {shift.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No default shifts</p>
                  )}
                </div>
              </div>

              {/* Custom Shifts */}
              <div>
                <h3 className="text-xs font-medium text-gray-700 mb-2">Custom Shifts</h3>
                <div className="flex flex-wrap gap-1.5">
                  {customShifts.length > 0 ? (
                    <>
                      {customShifts.slice(0, 5).map((shift) => (
                        <span 
                          key={shift.id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                          title={shift.start_time && shift.end_time ? `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}` : ''}
                        >
                          {shift.name}
                        </span>
                      ))}
                      {customShifts.length > 5 && (
                        <span className="text-xs text-gray-500 italic self-center">
                          +{customShifts.length - 5} more
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">No custom shifts</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rotation Grid */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Rotation Schedule</h2>
              <div className="text-sm text-gray-600">
                Click on cells to assign shifts
              </div>
            </div>
            
            {/* Night Shift Info Card */}
            <div className="mb-6">
              <NightShiftInfoCard />
            </div>
            
            <RotationGrid 
              rotations={rotations || []} 
              durationWeeks={plan.duration_weeks}
              planId={id}
            />
          </div>

          {/* Shift Summary Statistics */}
          <ShiftSummary 
            rotations={rotations || []} 
            shifts={shifts || []} 
          />
        </div>
      </main>
    </div>
  )
}