// src/app/plans/[id]/law-checks/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import LawChecksView from '@/components/lawChecks/LawChecksView'
import PlanDetails from '@/components/plan/PlanDetails'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function LawChecksPage({ params }: PageProps) {
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

  // Fetch base plan data if this is a helping plan
  let basePlanRotations = undefined
  let basePlanShifts = undefined
  let basePlan = undefined  // ADDED: the full base plan object
  let basePlanName = null

  if (plan.type === 'helping' && plan.base_plan_id) {
    // ADDED: Fetch the full base plan object first
    const { data: basePlanData } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan.base_plan_id)
      .single()
    
    basePlan = basePlanData || undefined
    basePlanName = basePlanData?.name || null

    // Fetch base plan rotations
    const { data: baseRotations } = await supabase
      .from('rotations')
      .select('*')
      .eq('plan_id', plan.base_plan_id)
      .order('week_index')
      .order('day_of_week')
    
    basePlanRotations = baseRotations || undefined

    // Fetch base plan shifts
    const { data: baseShifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('plan_id', plan.base_plan_id)
    
    basePlanShifts = baseShifts || undefined
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
                <p className="text-sm text-gray-600">Lovsjekk</p>
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
            activePage="lawChecks"
          />

          {/* Law Checks View - NOW WITH FULL BASE PLAN */}
          <LawChecksView 
            rotations={rotations || []}
            shifts={shifts || []}
            plan={plan}
            basePlanRotations={basePlanRotations}
            basePlanShifts={basePlanShifts}
            basePlan={basePlan}
          />
        </div>
      </main>
    </div>
  )
}