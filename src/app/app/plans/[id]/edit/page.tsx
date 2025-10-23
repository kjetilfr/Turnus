// src/app/plans/[id]/edit/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import EditPlanForm from '@/components/plan/EditPlanForm'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditPlanPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch the plan to edit
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (planError || !plan) {
    notFound()
  }

  // Fetch main plans for the base plan dropdown (only for helping plans)
  const { data: mainPlans } = await supabase
    .from('plans')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('type', 'main')
    .neq('id', id) // Exclude the current plan
    .order('name')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Edit Plan</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <EditPlanForm plan={plan} mainPlans={mainPlans || []} />
        </div>
      </main>
    </div>
  )
}