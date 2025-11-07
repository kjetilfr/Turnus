// src/app/subscribe/page.tsx - UPDATED with Pro/Premium tiers
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkSubscription } from '@/lib/supabase/subscriptionCheck'
import PricingCards from '@/components/pricing/PricingCards'
import FeatureComparison from '@/components/pricing/FeatureComparison'

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
            <Link href="/" className="text-2xl font-bold text-red-600">
              Turnus-Hjelp
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Link href="/blog" className="text-gray-600 hover:text-red-600">
                Artiklar
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Vel din plan
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              Les gratis artiklar eller vel Pro for turnusplanlegging
            </p>
            <p className="text-lg text-gray-500">
              Begge abonnement har 7 dagar gratis prøveperiode
            </p>
          </div>

          {/* Pricing Cards */}
          <PricingCards />

          {/* Feature Comparison */}
          <FeatureComparison />

          <p className="text-center text-gray-600 mt-8">
            Har du allereie abonnert?{' '}
            <Link href="/app" className="text-red-600 hover:text-red-700 font-semibold">
              Prøv å gå til appen
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}