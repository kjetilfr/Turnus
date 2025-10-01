// src/app/plans/[id]/calendar/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CalendarView from '@/components/calendar/CalendarView'
import PlanDetails from '@/components/plan/PlanDetails'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CalendarPage({ params }: PageProps) {
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

  if (shiftsError) {
    console.error('Error fetching shifts:', shiftsError)
  }

  // Fetch base plan if this is a helping plan
  let basePlanName = null
  if (plan.base_plan_id) {
    const { data } = await supabase
      .from('plans')
      .select('name')
      .eq('id', plan.base_plan_id)
      .single()
    basePlanName = data?.name || null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href={`/plans/${id}`}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Plan
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
                <p className="text-sm text-gray-600">Calendar View</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Plan Details Card with Rotation Button */}
          <PlanDetails 
            plan={plan} 
            basePlanName={basePlanName}
            showRotationButton={true}
          />

          {/* Calendar View */}
          <CalendarView 
            rotations={rotations || []} 
            shifts={shifts || []}
            planStartDate={plan.date_started}
            durationWeeks={plan.duration_weeks}
          />
        </div>
      </main>
    </div>
  )
}