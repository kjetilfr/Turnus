// src/app/(protected)/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import PlansList from '@/components/plan/PlansList'
import CreatePlanButton from '@/components/plan/CreatePlanButton'

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
  let basePlansMap = new Map()
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
          <h1 className="text-2xl font-bold text-gray-900">Nurse Scheduling Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with Create Button */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">My Plans</h2>
              <p className="text-gray-600 mt-1">Manage your scheduling plans</p>
            </div>
            <CreatePlanButton />
          </div>

          {/* Plans List */}
          <PlansList plans={plansWithBasePlan || []} />
        </div>
      </main>
    </div>
  )
}