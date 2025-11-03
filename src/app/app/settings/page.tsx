// src/app/app/settings/page.tsx - COMPLETE VERSION with Pro/Premium tiers
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ManageSubscriptionButton from '@/components/subscription/ManageSubscriptionButton'
import DeleteAccountButton from '@/components/account/DeleteAccountButton'
import LogoutButton from '@/components/LogoutButton'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get subscription details
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Format dates
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('no', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'trialing':
        return 'bg-blue-100 text-blue-800'
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800'
      case 'canceled':
        return 'bg-red-100 text-red-800'
      case 'incomplete':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Aktiv'
      case 'trialing':
        return 'Prøveperiode'
      case 'past_due':
        return 'Forfalt'
      case 'canceled':
        return 'Avslutta'
      case 'incomplete':
        return 'Ukomplett'
      default:
        return status
    }
  }

  // Get tier display info
  const getTierInfo = (tier: string | null) => {
    if (tier === 'premium') {
      return {
        name: 'Premium',
        price: '199',
        description: 'AI-assistert planlegging + alle Pro-funksjonar',
        color: 'purple'
      }
    }
    // Default to Pro
    return {
      name: 'Pro',
      price: '99',
      description: 'Ubegrensa turnussjekkar og kalendereksport',
      color: 'indigo'
    }
  }

  const tierInfo = getTierInfo(subscription?.tier)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link 
              href="/app"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Tilbake til Mine turnusar
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="text-2xl font-bold text-gray-900">Innstillingar</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Account Information Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Kontoinformasjon</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">E-post</span>
                <span className="font-medium text-gray-900">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-600">Brukar-ID</span>
                <span className="font-mono text-sm text-gray-600">{user.id}</span>
              </div>
            </div>
          </div>

          {/* Subscription Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Abonnement</h2>
              {subscription && (
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(subscription.status)}`}>
                  {getStatusText(subscription.status)}
                </span>
              )}
            </div>

            {subscription ? (
              <div className="space-y-4">
                {/* Subscription Details */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <p className="font-semibold text-gray-900">{getStatusText(subscription.status)}</p>
                  </div>

                  {/* Tier Display */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Abonnement</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{tierInfo.name}</p>
                      {subscription.tier === 'premium' && (
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded">
                          AI
                        </span>
                      )}
                    </div>
                  </div>

                  {subscription.current_period_end && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">
                        {subscription.status === 'trialing' ? 'Prøveperiode sluttar' : 'Neste fakturering'}
                      </p>
                      <p className="font-semibold text-gray-900">{formatDate(subscription.current_period_end)}</p>
                    </div>
                  )}

                  {subscription.trial_end && subscription.status === 'trialing' && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-600 mb-1">Prøveperiode aktiv</p>
                      <p className="font-semibold text-blue-900">Gratis til {formatDate(subscription.trial_end)}</p>
                    </div>
                  )}

                  {subscription.cancel_at_period_end && (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-600 mb-1">Avsluttar</p>
                      <p className="font-semibold text-yellow-900">
                        Tilgang til {formatDate(subscription.current_period_end)}
                      </p>
                    </div>
                  )}

                  {subscription.current_period_start && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Periode start</p>
                      <p className="font-semibold text-gray-900">{formatDate(subscription.current_period_start)}</p>
                    </div>
                  )}
                </div>

                {/* Pricing Information */}
                <div className={`p-4 bg-${tierInfo.color}-50 rounded-lg border border-${tierInfo.color}-200`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-semibold text-${tierInfo.color}-900`}>
                        Turnus-Hjelp {tierInfo.name}
                      </p>
                      <p className={`text-sm text-${tierInfo.color}-600`}>
                        {tierInfo.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold text-${tierInfo.color}-900`}>
                        {tierInfo.price} kr
                      </p>
                      <p className={`text-sm text-${tierInfo.color}-600`}>per månad</p>
                    </div>
                  </div>
                  
                  {/* Show upgrade option for Pro users */}
                  {subscription.tier === 'pro' && subscription.status === 'active' && (
                    <div className={`mt-4 pt-4 border-t border-${tierInfo.color}-200`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">
                            Oppgrader til Premium
                          </p>
                          <p className="text-sm text-gray-600">
                            Få tilgang til AI-funksjonar: PDF-import, smarte forbetringar og meir
                          </p>
                        </div>
                        <Link
                          href="/subscribe"
                          className="ml-4 flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors whitespace-nowrap"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Oppgrader
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Show AI features link for Premium users */}
                  {subscription.tier === 'premium' && subscription.status === 'active' && (
                    <div className={`mt-4 pt-4 border-t border-${tierInfo.color}-200`}>
                      <Link
                        href="/app/ai"
                        className="flex items-center gap-2 text-purple-600 font-semibold hover:text-purple-700 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Gå til AI-funksjonar →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Manage Subscription Button */}
                <div className="pt-4 border-t border-gray-200">
                  <ManageSubscriptionButton />
                  <p className="text-sm text-gray-500 mt-3">
                    Du vil bli omdirigert til Stripe for å administrere abonnementet ditt, oppdatere betalingsmetode, eller avbryte.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ingen aktivt abonnement</h3>
                <p className="text-gray-600 mb-6">Du har ikkje eit aktivt abonnement for øyeblikket.</p>
                <Link
                  href="/subscribe"
                  className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Vel abonnement
                </Link>
              </div>
            )}
          </div>

          {/* Tier Comparison Card - Show for Pro users only */}
          {subscription?.tier === 'pro' && subscription.status === 'active' && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg shadow-md p-6 border-2 border-purple-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Oppgrader til Premium for AI-funksjonar
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Få tilgang til kraftige AI-verktøy som automatisk lagar turnusplanar frå PDF og gir smarte forbetringsforslag.
                  </p>
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700">Last opp PDF → AI lagar plan</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700">AI-genererte forbetringar</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700">Automatisk fylle rotation</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700">Prioritert support</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/subscribe"
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                    >
                      Oppgrader no
                    </Link>
                    <span className="text-sm text-gray-600">
                      Berre 100 kr meir per månad
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
            <h2 className="text-xl font-semibold text-red-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Faresone
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Slett konto</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Når du slettar kontoen din vil alle turnusplanane dine, abonnementet, og all data bli permanent fjerna. Dette kan ikkje angrast.
                </p>
                <DeleteAccountButton />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}