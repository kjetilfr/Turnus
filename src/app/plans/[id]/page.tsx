// src/app/plans/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import RotationGrid from '@/components/rotation/RotationGrid'
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

  // Ensure rotations is always an array
  const rotationsList = rotations || []

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
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Plan Info Card */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Duration</div>
                <div className="text-lg font-semibold">
                  {plan.duration_weeks} {plan.duration_weeks === 1 ? 'week' : 'weeks'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Type</div>
                <div className="text-lg font-semibold capitalize">{plan.type}</div>
              </div>
              {basePlan && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Based On</div>
                  <div className="text-lg font-semibold">{basePlan.name}</div>
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

          {/* Rotation Grid */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Rotation Schedule</h2>
              <div className="text-sm text-gray-600">
                Click on cells to edit shifts (coming soon)
              </div>
            </div>
            <RotationGrid 
              rotations={rotations || []} 
              durationWeeks={plan.duration_weeks}
            />
          </div>
        </div>
      </main>
    </div>
  )
}