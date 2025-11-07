// src/app/page.tsx - UPDATED with 7-day trial emphasis and Pro branding
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ScreenshotCarousel from '@/components/landing/ScreenshotCarousel'
import LogoutButton from '@/components/LogoutButton'
import PricingCards from '@/components/pricing/PricingCards'
import { checkIsAdmin } from '@/lib/admin/checkAdmin'


export const metadata = {
  title: 'Turnus-Hjelp',
  description: 'Sjekk din turnus mot lovar og reglar i aml og hta. Prøv gratis i 7 dagar, ingen binding.'
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { isAdmin } = await checkIsAdmin()

  // Check if user has active subscription (Pro user)
  let isPro = false
  if (user) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()
    
    isPro = subscription?.status === 'active' || subscription?.status === 'trialing'
  }

  // Fetch latest blog articles - with error handling
  let articles = null
  let articlesError = null
  
  try {
    const result = await supabase
      .from('articles')
      .select('id, slug, title, description, published_at, reading_time_minutes, featured_image_url')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(3)
    
    articles = result.data
    articlesError = result.error
    
    if (articlesError) {
      console.error('Error fetching articles:', articlesError)
    }
  } catch (error) {
    console.error('Exception fetching articles:', error)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-2xl font-bold text-red-600 hover:text-red-700 transition-colors">
                Turnus-Hjelp {user && <span className="text-lg font-normal text-red-500">Pro</span>}
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link href="/blog" className="text-gray-600 hover:text-red-600 transition-colors font-medium">
                  Artiklar
                </Link>
                <Link href="#features" className="text-gray-600 hover:text-red-600 transition-colors font-medium">
                  Funksjonar
                </Link>
                {!user && (
                  <Link href="#pricing" className="text-gray-600 hover:text-red-600 transition-colors font-medium">
                    Prisar
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
                  <Link
                    href="/app"
                    className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-all hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    Gå til app
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hidden sm:block text-gray-600 hover:text-red-600 transition-colors font-medium"
                  >
                    Logg inn
                  </Link>
                  <Link
                    href="/login"
                    className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-all hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    Start gratis
                  </Link>
                </>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Admin Panel
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Image */}
      <section className="relative bg-white py-20 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10"></div>
        
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
            {/* Left Column - Text Content */}
            <div className="space-y-8">
              {/* Free Trial Badge */}
              {!isPro && !user && (
                <div className="inline-block">
                  <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold border-2 border-green-300 shadow-sm">
                    🎉 7 DAGAR GRATIS PRØVEPERIODE
                  </span>
                </div>
              )}
              
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                Er din turnus{' '}
                <span className="text-red-600">lovleg?</span>
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed">
                {isPro ? (
                  <>
                    Velkommen tilbake! Sjekk turnusen din automatisk mot arbeidsmiljøloven og tariffavtalar med <strong>Turnus-Hjelp Pro</strong>.
                  </>
                ) : (
                  <>
                    Sjekk turnusen din automatisk mot arbeidsmiljøloven og tariffavtalar med <strong>Turnus-Hjelp Pro</strong>. 
                    {!user && "Prøv gratis i 7 dagar - ingen kredittkort påkravd!"}
                  </>
                )}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                {user ? (
                  <>
                    <Link
                      href="/app"
                      className="bg-red-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-red-700 transition-all hover:shadow-xl transform hover:-translate-y-1 text-center"
                    >
                      {isPro ? "Gå til mine turnusar" : "Gå til app"}
                    </Link>
                    <Link
                      href="/blog"
                      className="bg-white text-red-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-all border-2 border-red-600 hover:shadow-lg text-center"
                    >
                      Les gratis artiklar
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="bg-red-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-red-700 transition-all hover:shadow-xl transform hover:-translate-y-1 text-center flex items-center justify-center gap-2"
                    >
                      <span>Start 7 dagar gratis</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                    <Link
                      href="/blog"
                      className="bg-white text-red-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-all border-2 border-red-600 hover:shadow-lg text-center"
                    >
                      Les gratis artiklar
                    </Link>
                  </>
                )}
              </div>

              {!isPro && (
                <div className="flex items-center gap-8 pt-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700 font-medium">7 dagar gratis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700 font-medium">Ingen binding</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700 font-medium">Automatiske sjekkar</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Image */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gray-100">
                <div className="aspect-[4/3] flex items-center justify-center">
                  <img src="images/lovsjekk_bilete_3.png" alt="Lovsjekk av turnus" className="w-full h-full object-contain"></img>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* App Screenshots Slideshow Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-red-600 font-semibold text-sm uppercase tracking-wide">Turnus-Hjelp Pro</span>
              <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">
                Enkel og kraftig turnusplanlegging
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Alt du treng for å lage og sjekke turnusen din på éin stad
              </p>
            </div>

            <ScreenshotCarousel />

            {!isPro && !user && (
              <div className="text-center mt-12">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all hover:shadow-lg"
                >
                  Prøv Pro gratis i 7 dagar
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Free Articles Promotion Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-red-600 font-semibold text-sm uppercase tracking-wide">Gratis ressursar</span>
              <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">
                Lær om dine rettar som turnusarbeidar
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Fullt tilgang til alle våre artiklar om arbeidsmiljøloven, tariffavtalar og beste praksis - heilt gratis
              </p>
            </div>

            {/* Article Grid */}
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {articlesError && (
                <div className="col-span-3 text-center py-12 bg-red-50 rounded-xl border border-red-200">
                  <svg className="w-16 h-16 mx-auto text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-xl font-bold text-red-900 mb-2">Kunne ikkje laste artiklar</h3>
                  <p className="text-red-700 mb-2">Det oppstod ein feil ved henting av artiklar.</p>
                </div>
              )}
              
              {!articlesError && articles && articles.length > 0 ? (
                articles.map(article => (
                  <Link
                    key={article.id}
                    href={`/blog/${article.slug}`}
                    className="group bg-white rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
                  >
                    {/* Article Image */}
                    <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
                      {article.featured_image_url ? (
                        <img 
                          src={article.featured_image_url} 
                          alt={article.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6">
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                        {article.reading_time_minutes && (
                          <>
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {article.reading_time_minutes} min
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>Gratis</span>
                      </div>
                      
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors line-clamp-2">
                        {article.title}
                      </h3>
                      
                      {article.description && (
                        <p className="text-gray-600 line-clamp-3 text-sm">
                          {article.description}
                        </p>
                      )}
                      
                      <div className="mt-4 flex items-center text-red-600 font-semibold text-sm group-hover:gap-2 transition-all">
                        Les meir
                        <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))
              ) : !articlesError ? (
                <div className="col-span-3 text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Artiklar kjem snart!</h3>
                  <p className="text-gray-600 mb-6">Vi jobbar med å lage nyttig innhald for deg</p>
                  <Link
                    href="/blog"
                    className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-700"
                  >
                    Sjekk bloggen
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="text-center">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all hover:shadow-lg"
              >
                Sjå alle gratis artiklar
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-red-600 font-semibold text-sm uppercase tracking-wide">Turnus-Hjelp Pro</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">
              Automatiske lovsjekkar
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Vi sjekkar turnusen din mot Arbeidsmiljøloven og din tariffavtale. 
              Få detaljerte rapportar om kva som stemmer og kva som må rettast.
            </p>
          </div>

          {/* Law Checks Grid */}
          <div className="max-w-7xl mx-auto mb-16">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Vi tester for desse reglane:</h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 3-delt snitt */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-red-600">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">3-delt snitt</h4>
                    <p className="text-sm text-gray-600">
                      Sjekkar om du kvalifiserer til 33,6 eller 35,5 timar per veke basert på nattarbeid, søndagsarbeid og døgndekning
                    </p>
                  </div>
                </div>
              </div>

              {/* F5 Erstatningsfridag */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-purple-600">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">F5 dagar</h4>
                    <p className="text-sm text-gray-600">
                      Kontrollerer at du får erstatningsfridag når F1 (ukefridag) fell på helgedagar
                    </p>
                  </div>
                </div>
              </div>

              {/* F3 Helgedagsfri */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-pink-600">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">F3 dagar</h4>
                    <p className="text-sm text-gray-600">
                      Verifiserer at du får riktig antal fridagar etter arbeid på helge- og høgtidsdagar
                    </p>
                  </div>
                </div>
              </div>

              {/* Kompenserande kvile */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-blue-600">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Kompenserande kvile</h4>
                    <p className="text-sm text-gray-600">
                      Sjekkar at du får nok kviletid mellom vakter, og at eventuelle underskot vert kompensert
                    </p>
                  </div>
                </div>
              </div>

              {/* Ferie */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-green-600">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Ferie</h4>
                    <p className="text-sm text-gray-600">
                      Kontrollerer at du har fått riktig antal feriedagar og ferietimar basert på stillingsprosent
                    </p>
                  </div>
                </div>
              </div>

              {/* Kviletid F1 */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 border-yellow-600">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Kviletid F1</h4>
                    <p className="text-sm text-gray-600">
                      Verifiserer at F1 (ukefridag) har tilstrekkeleg kviletid før og etter, minimum 35 timar
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tariffavtaler Section */}
          <div className="max-w-7xl mx-auto">
            <div className="bg-gray-50 rounded-2xl p-8 md:p-12 border border-gray-200">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Støtte for alle store tariffavtalar</h3>
                <p className="text-gray-600">Vi sjekkar turnusen din mot både Arbeidsmiljøloven og din spesifikke tariffavtale</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Tariffavtaler Column */}
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Tariffavtalar
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700"><strong>KS</strong> (Kommunesektoren)</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700"><strong>Staten</strong> (Statlige verksemder)</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700"><strong>Oslo kommune</strong></span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700"><strong>Spekter</strong> (Helseføretak)</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700"><strong>Ingen tariffavtale</strong> (Kun AML)</span>
                    </li>
                  </ul>
                </div>

                {/* Arbeidsmiljøloven Column */}
                <div className="bg-white rounded-xl p-6 shadow-md">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    Arbeidsmiljøloven
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">Dagleg og ukentleg arbeidsfri (§10-8)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">Alminnelig arbeidstid (§10-4, §10-5)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">Søn- og helgedagsarbeid (§10-10)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">Ferielov (§12-5)</span>
                    </li>
                  </ul>
                </div>
              </div>

              {!isPro && !user && (
                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all hover:shadow-lg"
                  >
                    Start 7 dagar gratis
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

            {/* Pricing Section - Only show for non-Pro users */}
            {!isPro && !user && (
              <section id="pricing" className="py-20 bg-white">
                <div className="container mx-auto px-4">
                  <div className="text-center mb-16">
                    <span className="text-red-600 font-semibold text-sm uppercase tracking-wide">Prisar</span>
                    <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">
                      Gratis artiklar + turnusplanlegging
                    </h2>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                      Les våre artiklar gratis eller vel Pro/Premium for turnusplanlegging.<br/>
                      <strong>7 dagar gratis prøveperiode - ingen kredittkort påkravd!</strong>
                    </p>
                  </div>

                  {/* Import the PricingCards component */}
                  <PricingCards />

                  {/* Trust badges */}
                  <div className="mt-16 text-center">
                    <p className="text-gray-600 mb-6">Stol på av hundrevis av helsearbeidarar</p>
                    <div className="flex justify-center items-center gap-8 flex-wrap">
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Sikker betaling</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">GDPR-kompatibel</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Norsk selskap</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Turnus-Hjelp Pro</h3>
              <p className="text-gray-400 text-sm">
                Lag lovlege turnusar med automatiske sjekkar mot arbeidsmiljøloven og tariffavtalar.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produkt</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#features" className="hover:text-white transition-colors">Funksjonar</Link></li>
                {!user && <li><Link href="#pricing" className="hover:text-white transition-colors">Prisar</Link></li>}
                <li><Link href="/blog" className="hover:text-white transition-colors">Artiklar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ressursar</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/blog/category/arbeidsmiljoloven" className="hover:text-white transition-colors">Arbeidsmiljøloven</Link></li>
                <li><Link href="/blog/category/tariffavtalar" className="hover:text-white transition-colors">Tariffavtalar</Link></li>
                <li><Link href="/blog/category/turnusplanlegging" className="hover:text-white transition-colors">Planleggingsguider</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Selskap</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">Om oss</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Kontakt</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Personvern</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 Turnus-Hjelp Pro. Alle rettar reserverte.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}