// src/app/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import PlansList from '@/components/plan/PlansList'
import CreatePlanButton from '@/components/plan/CreatePlanButton'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all plans for the user
  const { data: plans, error } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching plans:', error)
  }

  // Get all base plan IDs
  const basePlanIds = plans?.filter(p => p.base_plan_id).map(p => p.base_plan_id) || []
  
  // Fetch base plans if there are any
  const basePlansMap = new Map()
  if (basePlanIds.length > 0) {
    const { data: basePlans } = await supabase
      .from('plans')
      .select('*')
      .in('id', basePlanIds)
    
    if (basePlans) {
      basePlans.forEach(plan => basePlansMap.set(plan.id, plan))
    }
  }

  // Merge base plans with main plans
  const plansWithBasePlan = plans?.map(plan => ({
    ...plan,
    base_plan: plan.base_plan_id ? basePlansMap.get(plan.base_plan_id) : null
  })) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Turnus Hjelp</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with Create Button and Guide Button */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Mine turnusar</h2>
              <p className="text-gray-600 mt-1">Administrer turnusane dine</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/guide"
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Sjå guiden
              </Link>
              <CreatePlanButton />
            </div>
          </div>

          {/* Plans List */}
          <PlansList plans={plansWithBasePlan || []} />
        </div>
      </main>
    </div>
  )
}