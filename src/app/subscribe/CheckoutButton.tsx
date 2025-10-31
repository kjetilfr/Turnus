// src/app/subscribe/CheckoutButton.tsx
'use client'

import { useState } from 'react'

export function CheckoutButton() {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    try {
      setLoading(true)

      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.error) {
        alert('Feil: ' + data.error)
        return
      }

      // Redirect to Stripe Checkout URL
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Noko gjekk galt. Prøv igjen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="block w-full bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Laster...' : 'Start 7 dagar gratis'}
    </button>
  )
}