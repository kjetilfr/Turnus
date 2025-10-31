// src/app/subscribe/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkSubscription } from '@/lib/supabase/subscriptionCheck'

export default async function SubscribePage() {
  const { hasAccess, user } = await checkSubscription()

  // If already has access, redirect to app
  if (hasAccess) {
    redirect('/app')
  }

  // Not logged in - redirect to login with return URL
  if (!user) {
    redirect('/login?next=/subscribe')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-indigo-600">
              Turnus-Hjelp
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Link href="/blog" className="text-gray-600 hover:text-indigo-600">
                Artiklar
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Abonner for å få tilgang til turnussjekk
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Les gratis artiklar eller abonner for å sjekke din turnus mot lovverket
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-8">
            {/* Free - Articles Only */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Gratis</h3>
              <div className="text-4xl font-bold text-gray-900 mb-4">0 kr</div>
              <ul className="space-y-3 mb-6 text-left">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Alle gratis artiklar</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Guide til turnusplanlegging</span>
                </li>
              </ul>
              <Link
                href="/blog"
                className="block w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                Les artiklar
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-2xl p-8 text-white relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                  POPULÆR
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-4 mt-2">Pro</h3>
              <div className="text-4xl font-bold mb-4">
                49 kr<span className="text-xl font-normal opacity-90">/mnd</span>
              </div>
              <ul className="space-y-3 mb-6 text-left">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Alt i gratis</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Ubegrensa turnusplanar</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Automatiske lovsjekkar</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Kalendereksport</span>
                </li>
              </ul>
              <button
                className="block w-full bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all"
              >
                Start 7 dagar gratis
              </button>
            </div>
          </div>

          <p className="text-gray-600">
            Har du allereie abonnert?{' '}
            <Link href="/app" className="text-indigo-600 hover:text-indigo-700 font-semibold">
              Prøv å gå til appen
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}