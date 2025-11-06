// src/components/admin/AdministratorsManager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  created_at: string
  is_admin: boolean
  last_sign_in_at: string | null
}

interface AdministratorsManagerProps {
  users: User[]
  currentAdminId: string
}

export default function AdministratorsManager({ users: initialUsers, currentAdminId }: AdministratorsManagerProps) {
  const [users, setUsers] = useState(initialUsers)
  const [filter, setFilter] = useState<'all' | 'admins' | 'users'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState<{ userId: string, email: string, action: 'grant' | 'revoke' } | null>(null)
  const router = useRouter()

  const filteredUsers = users.filter(user => {
    // Filter by search query
    if (searchQuery && !user.email.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    // Filter by admin status
    if (filter === 'admins') return user.is_admin
    if (filter === 'users') return !user.is_admin
    return true
  })

  const adminsCount = users.filter(u => u.is_admin).length
  const regularUsersCount = users.filter(u => !u.is_admin).length

  const handleGrantAdmin = async (userId: string, email: string) => {
    setShowConfirmModal({ userId, email, action: 'grant' })
  }

  const handleRevokeAdmin = async (userId: string, email: string) => {
    setShowConfirmModal({ userId, email, action: 'revoke' })
  }

  const executeAction = async () => {
    if (!showConfirmModal) return

    const { userId, email, action } = showConfirmModal

    try {
      setLoading(userId)

      const response = await fetch('/api/admin/manage-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          isAdmin: action === 'grant'
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update admin status')
      }

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === userId 
          ? { ...u, is_admin: action === 'grant' }
          : u
      ))

      alert(`✅ ${action === 'grant' ? 'Granted' : 'Revoked'} admin access for ${email}`)
      router.refresh()
    } catch (error) {
      console.error('Error updating admin status:', error)
      alert('❌ ' + (error instanceof Error ? error.message : 'Failed to update admin status'))
    } finally {
      setLoading(null)
      setShowConfirmModal(null)
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setFilter('admins')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'admins'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Admins ({adminsCount})
            </button>
            <button
              onClick={() => setFilter('users')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'users'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Regular Users ({regularUsersCount})
            </button>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Sign In
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map(user => {
                  const isCurrentUser = user.id === currentAdminId
                  
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">
                              {user.email}
                            </div>
                            {isCurrentUser && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.id.substring(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.is_admin ? (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Administrator
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Regular User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.last_sign_in_at 
                          ? new Date(user.last_sign_in_at).toLocaleDateString('no', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Never'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {user.is_admin ? (
                          <button
                            onClick={() => handleRevokeAdmin(user.id, user.email)}
                            disabled={loading === user.id || isCurrentUser}
                            className="px-3 py-1 text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={isCurrentUser ? "You cannot remove your own admin access" : "Revoke admin access"}
                          >
                            {isCurrentUser ? 'Cannot Remove Self' : 'Revoke Admin'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGrantAdmin(user.id, user.email)}
                            disabled={loading === user.id}
                            className="px-3 py-1 text-purple-700 bg-purple-100 rounded hover:bg-purple-200 disabled:opacity-50 transition-colors"
                          >
                            Grant Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No users found
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                showConfirmModal.action === 'grant' 
                  ? 'bg-purple-100'
                  : 'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  showConfirmModal.action === 'grant'
                    ? 'text-purple-600'
                    : 'text-red-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showConfirmModal.action === 'grant' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  )}
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {showConfirmModal.action === 'grant' ? 'Grant Admin Access?' : 'Revoke Admin Access?'}
                </h3>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to {showConfirmModal.action === 'grant' ? 'grant' : 'revoke'} admin access {showConfirmModal.action === 'grant' ? 'to' : 'from'}:
              <br />
              <strong className="text-gray-900">{showConfirmModal.email}</strong>
            </p>

            {showConfirmModal.action === 'grant' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  This user will have full access to admin features including managing subscriptions, articles, and other administrators.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                disabled={loading !== null}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={loading !== null}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  showConfirmModal.action === 'grant'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {loading ? 'Processing...' : showConfirmModal.action === 'grant' ? 'Grant Admin' : 'Revoke Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}