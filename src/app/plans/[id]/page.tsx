// src/app/plans/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import RotationGrid from '@/components/rotation/RotationGrid'
import ShiftSummary from '@/components/rotation/ShiftSummary'
import NightShiftInfoCard from '@/components/rotation/NightShiftInfoCard'
import PlanDetails from '@/components/plan/PlanDetails'
import ShiftsSummaryCard from '@/components/shift/ShiftsSummaryCard'
import ManageShiftsButton from '@/components/shift/ManageShiftsButton'
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
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Tilbake til plan
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
                <p className="text-sm text-gray-600">Turnus</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Plan Details Card */}
          <PlanDetails 
            plan={plan} 
            basePlanName={basePlanName}
            activePage="rotation"
          />

          {/* Rotation Grid */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Rotation Schedule</h2>
              <ManageShiftsButton planId={id} />
            </div>

            {/* Shifts Summary */}
            <ShiftsSummaryCard 
              defaultShifts={defaultShifts}
              customShifts={customShifts}
            />
            
            {/* Night Shift Info Card */}
            <div className="mb-6">
              <NightShiftInfoCard />
            </div>
            
            <RotationGrid 
              rotations={rotations || []} 
              durationWeeks={plan.duration_weeks}
              planId={id}
              planType={plan.type}
            />
          </div>

          {/* Shift Summary Statistics */}
          <ShiftSummary 
            rotations={rotations || []} 
            shifts={shifts || []}
            planType={plan.type}
          />
        </div>
      </main>
    </div>
  )
}