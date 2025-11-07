// src/app/admin/administrators/page.tsx
import { supabaseAdmin } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { checkIsAdmin } from '@/lib/admin/checkAdmin'
import Link from 'next/link'
import AdministratorsManager from '@/components/admin/AdministratorsManager'

export default async function AdministratorsPage() {
  const { isAdmin, user } = await checkIsAdmin()

  if (!user) {
    redirect('/login')
  }

  if (!isAdmin) {
    redirect('/app')
  }

  // Fetch all users
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()

  // Separate admins from regular users
  const admins = authUsers?.users.filter(u => u.user_metadata?.is_admin === true) || []
  const regularUsers = authUsers?.users.filter(u => !u.user_metadata?.is_admin) || []

  const allUsers = authUsers?.users.map(u => ({
    id: u.id,
    email: u.email || '',
    created_at: u.created_at,
    is_admin: u.user_metadata?.is_admin === true,
    last_sign_in_at: u.last_sign_in_at || null
  })) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/admin"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Tilbake til admin
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Administrators</h1>
                <p className="text-sm text-gray-600">Add or remove admin access for users</p>
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
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-3xl font-bold text-gray-900">{admins.length}</div>
              <div className="text-sm text-gray-600">Current Administrators</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-3xl font-bold text-gray-900">{regularUsers.length}</div>
              <div className="text-sm text-gray-600">Regular Users</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-3xl font-bold text-gray-900">{allUsers.length}</div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
          </div>

          {/* Warning Box */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Administrators have full access to all admin features</li>
                    <li>Be careful when removing admin access - make sure at least one admin always exists</li>
                    <li>You cannot remove your own admin access</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Administrators Manager Component */}
          <AdministratorsManager 
            users={allUsers}
            currentAdminId={user.id}
          />

        </div>
      </main>
    </div>
  )
}