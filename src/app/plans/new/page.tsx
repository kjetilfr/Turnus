// src/app/plans/new/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CreatePlanForm from '@/components/CreatePlanForm'

export default async function NewPlanPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch main plans for the base plan dropdown (only for helping plans)
  const { data: mainPlans } = await supabase
    .from('plans')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('type', 'main')
    .order('name')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Create New Plan</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <CreatePlanForm mainPlans={mainPlans || []} />
        </div>
      </main>
    </div>
  )
}