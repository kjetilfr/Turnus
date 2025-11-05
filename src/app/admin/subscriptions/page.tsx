// src/app/admin/subscriptions/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkIsAdmin } from '@/lib/admin/checkAdmin'
import Link from 'next/link'
import AdminSubscriptionManager from '@/components/admin/AdminSubscriptionManager'

export default async function AdminSubscriptionsPage() {
  const { isAdmin, user } = await checkIsAdmin()

  if (!user) {
    redirect('/login')
  }

  if (!isAdmin) {
    redirect('/app')
  }

  const supabase = await createClient()

  // Fetch all users with their subscription status
  const { data: users, error } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      created_at,
      subscriptions (
        id,
        tier,
        status,
        stripe_subscription_id,
        stripe_customer_id,
        current_period_start,
        current_period_end,
        trial_end,
        is_manual,
        manual_granted_by,
        manual_granted_at
      )
    `)
    .order('created_at', { ascending: false })

  // Fallback: get users from auth if profiles table doesn't exist
  let allUsers = users

  if (error || !users) {
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    
    const userIds = authUsers.users.map(u => u.id)
    
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*')
      .in('user_id', userIds)

    allUsers = authUsers.users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      subscriptions: subs?.filter(s => s.user_id === u.id) || []
    }))
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
                ← Tilbake til app
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin: Subscription Management</h1>
                <p className="text-sm text-gray-600">Grant manual subscriptions for testing</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full font-semibold">
                Admin
              </span>
              <span className="text-sm text-gray-600">{user.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <AdminSubscriptionManager users={allUsers || []} />
        </div>
      </main>
    </div>
  )
}