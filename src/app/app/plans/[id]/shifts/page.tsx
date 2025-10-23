// src/app/plans/[id]/shifts/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ShiftsList from '@/components/shift/ShiftList'
import CreateShiftButton from '@/components/shift/CreateShiftButton'
import ImportShiftsButton from '@/components/shift/ImportShiftsButton'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ShiftsPage({ params }: PageProps) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href={`/plans/${id}`}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Plan
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Shifts</h1>
                <p className="text-sm text-gray-600">{plan.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ImportShiftsButton planId={id} />
              <CreateShiftButton planId={id} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <svg 
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">About Shifts:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>F1-F5 are default shifts created automatically and cannot be edited or deleted</li>
                  <li>Custom shifts require start and end times</li>
                  <li>All shifts can be assigned to rotation cells in the schedule</li>
                  <li>Use &quot;Import Shifts&quot; to copy custom shifts from another plan</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Shifts List */}
          <ShiftsList shifts={shifts || []} planId={id} />
        </div>
      </main>
    </div>
  )
}