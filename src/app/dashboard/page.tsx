'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  // Settings state
  const [darkMode, setDarkMode] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
    
    // Load dark mode preference from localStorage
    const savedDarkMode = localStorage.getItem('darkMode') === 'true'
    setDarkMode(savedDarkMode)
  }, [user, loading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    localStorage.setItem('darkMode', newDarkMode.toString())
    
    // Apply dark mode to document
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    showMessage('Dark mode ' + (newDarkMode ? 'enabled' : 'disabled'), 'success')
  }

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('New passwords don&apos;t match', 'error')
      return
    }

    if (passwordData.newPassword.length < 6) {
      showMessage('Password must be at least 6 characters', 'error')
      return
    }

    setIsChangingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) {
        showMessage(error.message, 'error')
      } else {
        showMessage('Password updated successfully!', 'success')
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      }
    } catch (error) {
      showMessage('An error occurred while updating password', 'error')
    }

    setIsChangingPassword(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Home
              </button>
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.email?.split('@')[0]}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Message Display */}
          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              messageType === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-6">
            {/* Account Information */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Account Information</h2>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-black">Email</label>
                    <p className="mt-1 text-sm text-gray-600">{user.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black">User ID</label>
                    <p className="mt-1 text-sm text-gray-600 font-mono">{user.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black">Account Created</label>
                    <p className="mt-1 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Change Password</h2>
              </div>
              <div className="px-6 py-4">
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-black">
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      minLength={6}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-black">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      minLength={6}
                      required
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Dark Mode Setting */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Appearance</h2>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-black">Dark Mode</h3>
                    <p className="text-sm text-gray-600">
                      Switch between light and dark themes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleDarkMode}
                    className={`${
                      darkMode ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                  >
                    <span
                      className={`${
                        darkMode ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white shadow rounded-lg border border-red-200">
              <div className="px-6 py-4 border-b border-red-200 bg-red-50">
                <h2 className="text-lg font-medium text-red-900">Danger Zone</h2>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-black">Sign Out</h3>
                    <p className="text-sm text-gray-600">
                      Sign out of your account on this device
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}