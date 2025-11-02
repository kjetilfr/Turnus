// src/components/account/DeleteAccountButton.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteAccountButton() {
  const [showModal, setShowModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleDelete = async () => {
    // Validate confirmation text
    if (confirmText !== 'SLETT') {
      setError('Du må skrive "SLETT" for å bekrefte')
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/account/delete', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      // Success! Redirect to home page
      window.location.href = '/?deleted=true'
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Noko gjekk galt')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
      >
        Slett konto
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Slett konto permanent</h3>
                <p className="text-sm text-gray-500">Denne handlinga kan ikkje angrast</p>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded">
              <p className="text-sm text-red-800 font-semibold mb-2">Dette vil bli sletta permanent:</p>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li>Kontoen din</li>
                <li>Alle turnusplanar</li>
                <li>Alle vakter og rotasjonar</li>
                <li>Ditt abonnement (vil bli avslutta)</li>
                <li>All historikk og innstillingar</li>
              </ul>
            </div>

            {/* Confirmation Input */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Skriv <span className="text-red-600">SLETT</span> for å bekrefte:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value)
                  setError('')
                }}
                placeholder="SLETT"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={loading}
              />
              {error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setConfirmText('')
                  setError('')
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || confirmText !== 'SLETT'}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Slettar...
                  </>
                ) : (
                  'Slett konto permanent'
                )}
              </button>
            </div>

            {/* Additional Warning */}
            <p className="text-xs text-gray-500 text-center mt-4">
              Du vil bli logga ut og omdirigert til hovudsida
            </p>
          </div>
        </div>
      )}
    </>
  )
}