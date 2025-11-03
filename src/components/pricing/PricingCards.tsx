// src/components/pricing/PricingCards.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PricingTier {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
  tier: 'pro' | 'premium'
}

const tiers: PricingTier[] = [
  {
    name: 'Pro',
    price: '49',
    period: '/månad',
    description: 'Perfekt for sjukepleiarar som vil ha kontroll',
    tier: 'pro',
    features: [
      'Opprett ubegrensa turnusplanar',
      'Automatisk lovsjekk',
      'Eksporter til PDF og Excel',
      'Statistikk og rapportar',
      '7 dagar gratis prøveperiode',
    ],
    cta: 'Start gratis prøveperiode',
  },
  {
    name: 'Premium',
    price: '79',
    period: '/månad',
    description: 'For deg som vil ha KI-hjelp til planlegging',
    tier: 'premium',
    highlighted: true,
    features: [
      'Alt i Pro, pluss:',
      'Last opp pdf av din turnus',
      'KI-genererte forbetringar',
      'KI anbefalingar basert på dine preferansar',
      '7 dagar gratis prøveperiode',
    ],
    cta: 'Start gratis prøveperiode',
  },
]

export default function PricingCards() {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const handleSubscribe = async (tier: 'pro' | 'premium') => {
    try {
      setLoading(tier)

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Noko gjekk galt')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Kunne ikkje starte abonnement. Prøv igjen.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      {tiers.map((tier) => (
        <div
          key={tier.tier}
          className={`rounded-2xl p-8 ${
            tier.highlighted
              ? 'bg-gradient-to-br from-red-600 to-red-700 text-white shadow-2xl scale-105 border-4 border-red-400'
              : 'bg-white shadow-lg border border-gray-200'
          }`}
        >
          {tier.highlighted && (
            <div className="bg-yellow-400 text-red-900 text-sm font-bold px-4 py-1 rounded-full inline-block mb-4">
              🔥 MEST POPULÆR
            </div>
          )}

          <h3
            className={`text-2xl font-bold mb-2 ${
              tier.highlighted ? 'text-white' : 'text-gray-900'
            }`}
          >
            {tier.name}
          </h3>

          <p
            className={`mb-6 ${
              tier.highlighted ? 'text-red-100' : 'text-gray-600'
            }`}
          >
            {tier.description}
          </p>

          <div className="mb-6">
            <span
              className={`text-5xl font-bold ${
                tier.highlighted ? 'text-white' : 'text-gray-900'
              }`}
            >
              {tier.price} kr
            </span>
            <span
              className={`text-xl ${
                tier.highlighted ? 'text-red-100' : 'text-gray-600'
              }`}
            >
              {tier.period}
            </span>
          </div>

          <ul className="space-y-4 mb-8">
            {tier.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <svg
                  className={`w-6 h-6 flex-shrink-0 ${
                    tier.highlighted ? 'text-green-300' : 'text-green-600'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span
                  className={
                    tier.highlighted ? 'text-white' : 'text-gray-700'
                  }
                >
                  {feature}
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleSubscribe(tier.tier)}
            disabled={loading !== null}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              tier.highlighted
                ? 'bg-white text-red-600 hover:bg-red-50 shadow-lg'
                : 'bg-red-600 text-white hover:bg-red-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading === tier.tier ? 'Lastar...' : tier.cta}
          </button>

          <p
            className={`text-center text-sm mt-4 ${
              tier.highlighted ? 'text-red-100' : 'text-gray-500'
            }`}
          >
            Ingen binding • Avbryt når som helst
          </p>
        </div>
      ))}
    </div>
  )
}