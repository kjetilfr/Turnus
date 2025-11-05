// src/components/admin/AdminSubscriptionManager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email?: string
  created_at: string
  subscriptions?: any[]
}

interface AdminSubscriptionManagerProps {
  users: User[]
}

export default function AdminSubscriptionManager({ users: initialUsers }: AdminSubscriptionManagerProps) {
  const [users, setUsers] = useState(initialUsers)
  const [filter, setFilter] = useState<'all' | 'active' | 'manual' | 'stripe' | 'none'>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const filteredUsers = users.filter(user => {
    // Filter by search query
    if (searchQuery && !user.email?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    // Filter by subscription status
    const subscription = user.subscriptions?.[0]
    
    if (filter === 'active') {
      return subscription?.status === 'active' || subscription?.status === 'trialing'
    }
    if (filter === 'manual') {
      return subscription?.is_manual === true
    }
    if (filter === 'stripe') {
      return subscription?.stripe_subscription_id && !subscription?.is_manual
    }
    if (filter === 'none') {
      return !subscription || subscription.status === 'canceled'
    }
    
    return true
  })

  const handleGrantSubscription = async (
    userId: string, 
    email: string, 
    tier: 'pro' | 'premium',
    durationDays?: number
  ) => {
    if (!confirm(`Grant ${tier} subscription to ${email}?`)) {
      return
    }

    try {
      setLoading(userId)

      const response = await fetch('/api/admin/grant-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier, durationDays }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to grant subscription')
      }

      alert(`✅ ${tier} subscription granted to ${email}`)
      router.refresh()
    } catch (error) {
      console.error('Error granting subscription:', error)
      alert('❌ ' + (error instanceof Error ? error.message : 'Failed to grant subscription'))
    } finally {
      setLoading(null)
    }
  }

  const handleRevokeSubscription = async (userId: string, email: string) => {
    if (!confirm(`Revoke subscription for ${email}?`)) {
      return
    }

    try {
      setLoading(userId)

      const response = await fetch('/api/admin/revoke-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke subscription')
      }

      alert(`✅ Subscription revoked for ${email}`)
      router.refresh()
    } catch (error) {
      console.error('Error revoking subscription:', error)
      alert('❌ ' + (error instanceof Error ? error.message : 'Failed to revoke subscription'))
    } finally {
      setLoading(null)
    }
  }

  const getSubscriptionBadge = (user: User) => {
    const subscription = user.subscriptions?.[0]
    
    if (!subscription || subscription.status === 'canceled') {
      return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">No Subscription</span>
    }

    if (subscription.is_manual) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Manual {subscription.tier?.toUpperCase()}
        </span>
      )
    }

    if (subscription.status === 'active') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Active {subscription.tier?.toUpperCase()}
        </span>
      )
    }

    if (subscription.status === 'trialing') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Trial {subscription.tier?.toUpperCase()}
        </span>
      )
    }

    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        {subscription.status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-3xl font-bold text-gray-900">{users.length}</div>
          <div className="text-sm text-gray-600">Total Users</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-3xl font-bold text-green-600">
            {users.filter(u => u.subscriptions?.[0]?.status === 'active' || u.subscriptions?.[0]?.status === 'trialing').length}
          </div>
          <div className="text-sm text-gray-600">Active Subs</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-3xl font-bold text-purple-600">
            {users.filter(u => u.subscriptions?.[0]?.is_manual).length}
          </div>
          <div className="text-sm text-gray-600">Manual Grants</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-3xl font-bold text-blue-600">
            {users.filter(u => u.subscriptions?.[0]?.stripe_subscription_id && !u.subscriptions?.[0]?.is_manual).length}
          </div>
          <div className="text-sm text-gray-600">Stripe Subs</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-3xl font-bold text-gray-600">
            {users.filter(u => !u.subscriptions?.[0] || u.subscriptions?.[0]?.status === 'canceled').length}
          </div>
          <div className="text-sm text-gray-600">No Sub</div>
        </div>
      </div>

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
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active ({users.filter(u => u.subscriptions?.[0]?.status === 'active' || u.subscriptions?.[0]?.status === 'trialing').length})
          </button>
          <button
            onClick={() => setFilter('manual')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'manual'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Manual ({users.filter(u => u.subscriptions?.[0]?.is_manual).length})
          </button>
          <button
            onClick={() => setFilter('stripe')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'stripe'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Stripe ({users.filter(u => u.subscriptions?.[0]?.stripe_subscription_id && !u.subscriptions?.[0]?.is_manual).length})
          </button>
          <button
            onClick={() => setFilter('none')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'none'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            No Sub ({users.filter(u => !u.subscriptions?.[0] || u.subscriptions?.[0]?.status === 'canceled').length})
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
                  Details
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map(user => {
                const subscription = user.subscriptions?.[0]
                
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.id.substring(0, 8)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSubscriptionBadge(user)}
                    </td>
                    <td className="px-6 py-4">
                      {subscription ? (
                        <div className="text-xs text-gray-600 space-y-1">
                          {subscription.is_manual && (
                            <div className="text-purple-600 font-medium">
                              ⚡ Manual Grant
                            </div>
                          )}
                          {subscription.stripe_subscription_id && (
                            <div>Stripe: {subscription.stripe_subscription_id.substring(0, 12)}...</div>
                          )}
                          {subscription.current_period_end && (
                            <div>Ends: {new Date(subscription.current_period_end).toLocaleDateString('no')}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">No subscription</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {subscription?.is_manual ? (
                          <button
                            onClick={() => handleRevokeSubscription(user.id, user.email || '')}
                            disabled={loading === user.id}
                            className="px-3 py-1 text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleGrantSubscription(user.id, user.email || '', 'pro')}
                              disabled={loading === user.id}
                              className="px-3 py-1 text-indigo-700 bg-indigo-100 rounded hover:bg-indigo-200 disabled:opacity-50"
                            >
                              Grant Pro
                            </button>
                            <button
                              onClick={() => handleGrantSubscription(user.id, user.email || '', 'premium')}
                              disabled={loading === user.id}
                              className="px-3 py-1 text-purple-700 bg-purple-100 rounded hover:bg-purple-200 disabled:opacity-50"
                            >
                              Grant Premium
                            </button>
                          </>
                        )}
                      </div>
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
  )
}