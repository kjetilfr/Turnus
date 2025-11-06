// src/app/admin/subscriptions/page.tsx
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { checkIsAdmin } from '@/lib/admin/checkAdmin'
import Link from 'next/link'
import AdminSubscriptionManager from '@/components/admin/AdminSubscriptionManager'

export default async function AdminSubscriptionsPage() {
  console.log('🚀 Admin subscriptions page loading...')
  
  const { isAdmin, user } = await checkIsAdmin()

  if (!user) {
    console.log('❌ No user, redirecting to login')
    redirect('/login')
  }

  if (!isAdmin) {
    console.log('❌ User is not admin, redirecting to app')
    redirect('/app')
  }

  console.log('✅ Admin user verified:', user.email)

  try {
    // Fetch all users using service role
    console.log('📊 Fetching users from auth.users...')
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
      throw new Error(`Failed to fetch users: ${authError.message}`)
    }

    console.log(`✅ Found ${authUsers.users.length} users in auth.users`)

    // Fetch all subscriptions
    console.log('📊 Fetching subscriptions...')
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')

    if (subsError) {
      console.error('❌ Error fetching subscriptions:', subsError)
      throw new Error(`Failed to fetch subscriptions: ${subsError.message}`)
    }

    console.log(`✅ Found ${subscriptions?.length || 0} subscriptions`)

    // Log subscription details
    if (subscriptions && subscriptions.length > 0) {
      console.log('📋 Subscription details:', subscriptions.map(s => ({
        user_id: s.user_id,
        tier: s.tier,
        status: s.status,
        is_manual: s.is_manual
      })))
    }

    // Combine users with their subscriptions
    const usersWithSubscriptions = authUsers.users.map(u => {
      const userSubs = subscriptions?.filter(s => s.user_id === u.id) || []
      
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        subscriptions: userSubs
      }
    })

    console.log(`✅ Combined data for ${usersWithSubscriptions.length} users`)

    // Log stats
    const usersWithActiveSubs = usersWithSubscriptions.filter(u => 
      u.subscriptions.some(s => s.status === 'active' || s.status === 'trialing')
    ).length
    
    const usersWithManualSubs = usersWithSubscriptions.filter(u => 
      u.subscriptions.some(s => s.is_manual === true)
    ).length

    console.log('📊 Stats:', {
      totalUsers: usersWithSubscriptions.length,
      usersWithActiveSubs,
      usersWithManualSubs,
      usersWithNoSubs: usersWithSubscriptions.length - usersWithSubscriptions.filter(u => u.subscriptions.length > 0).length
    })

    // Sample first user
    if (usersWithSubscriptions.length > 0) {
      console.log('👤 Sample user:', {
        email: usersWithSubscriptions[0].email,
        hasSubscriptions: usersWithSubscriptions[0].subscriptions.length > 0,
        subscriptions: usersWithSubscriptions[0].subscriptions
      })
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
            {/* Debug info - remove this after fixing */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Debug Info (check browser console for details):</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ Total users: {usersWithSubscriptions.length}</li>
                <li>✅ Users with active subs: {usersWithActiveSubs}</li>
                <li>✅ Users with manual subs: {usersWithManualSubs}</li>
                <li>✅ Total subscriptions: {subscriptions?.length || 0}</li>
              </ul>
              <p className="text-xs text-blue-600 mt-2">
                Open browser console (F12) to see detailed logs
              </p>
            </div>

            <AdminSubscriptionManager users={usersWithSubscriptions} />
          </div>
        </main>
      </div>
    )
  } catch (error) {
    console.error('💥 Fatal error in admin subscriptions page:', error)
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl">
          <div className="text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
            <p className="text-red-600 mb-4 font-mono text-sm">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
            
            <div className="text-left bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 font-semibold mb-2">Common causes:</p>
              <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>Missing SUPABASE_SERVICE_ROLE_KEY</strong>
                  <br />
                  <span className="text-xs">Check your .env.local file has this key set</span>
                </li>
                <li>
                  <strong>Database connection issue</strong>
                  <br />
                  <span className="text-xs">Verify your Supabase project URL is correct</span>
                </li>
                <li>
                  <strong>Permissions error</strong>
                  <br />
                  <span className="text-xs">Service role key might be invalid</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <Link
                href="/app"
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300"
              >
                Back to App
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}