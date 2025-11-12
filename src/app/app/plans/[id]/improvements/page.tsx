// src/app/app/plans/[id]/improvements/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PlanDetails from '@/components/plan/PlanDetails'
import AIImprovementsView from '@/components/ai/AIImprovementsView'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AIImprovementsPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check Premium access
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  const hasPremium = subscription?.tier === 'premium' && subscription?.status === 'active'

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
                href="/app"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Tilbake til turnusar
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
                <p className="text-sm text-gray-600">AI-forbetringar</p>
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
            activePage="improvements"
          />

          {hasPremium ? (
            <AIImprovementsView 
              plan={plan}
              rotations={rotations || []}
              shifts={shifts || []}
            />
          ) : (
            /* Upgrade prompt for non-Premium users */
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-lg p-8 border-2 border-purple-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Premium krevst
                </h3>
                <p className="text-gray-700 mb-6 text-lg">
                  AI-forbetringar er tilgjengeleg med Premium-abonnement.
                </p>
                
                <div className="bg-white rounded-lg p-6 mb-6 text-left max-w-md mx-auto">
                  <h4 className="font-bold text-gray-900 mb-3">Med Premium får du:</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">AI-drevne forbetringsforslag</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">Eigendefinerte krav</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">Visuell samanlikning</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">Automatisk PDF-import</span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/subscribe"
                    className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                  >
                    Oppgrader til Premium
                  </Link>
                  <Link
                    href={`/app/plans/${id}`}
                    className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-purple-600"
                  >
                    Tilbake til turnus
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}