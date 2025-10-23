import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Turnusplanleggar - Enkelt og lovleg',
  description: 'Lag lovlege turnusar med automatiske sjekkar mot arbeidsmiljøloven og tariffavtalar'
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch latest blog articles
  const { data: articles } = await supabase
    .from('articles')
    .select('id, slug, title, description, category, published_at, reading_time_minutes')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(3)

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-2xl font-bold text-indigo-600">
                Turnusplanleggar
              </Link>
              <Link href="/blog" className="text-gray-600 hover:text-gray-900">
                Artiklar
              </Link>
              <Link href="#features" className="text-gray-600 hover:text-gray-900">
                Funksjonar
              </Link>
              <Link href="#pricing" className="text-gray-600 hover:text-gray-900">
                Prisar
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  href="/app"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Gå til app
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Logg inn
                  </Link>
                  <Link
                    href="/login"
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Prøv i dag
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Sjekk din turnus!
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Automatiske sjekkar mot arbeidsmiljøloven og tariffavtalar. 
              Spar tid og unngå lovbrot.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/login"
                className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                Start for 99kr/mnd
              </Link>
              <Link
                href="/blog"
                className="bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-indigo-600"
              >
                Les artiklar gratis
              </Link>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Vi tilbyr gratis artiklar om kva du kan kreve som turnusarbeidar. Kva rettigheiter du har basert på din individuelle tariffavtale. Korleis arbeidsmiljølova brukast i turnusarbeid. For 99kr/mnd kan du lage din eigen turnus og sjekke den mot lovverket.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Er din turnus lovleg?
            </h2>
            <p className="text-xl text-gray-600">
              Mange som lagar turnus har feil forståing av lovverket eller er ikkje oppdatert.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Automatiske lovsjekkar
              </h3>
              <p className="text-gray-600">
                Sjekk automatisk mot AML og HTA. Støtter mange tariffavtalar.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Kalendervisning
              </h3>
              <p className="text-gray-600">
                Sjå turnusen din i ein oversiktleg kalender som du kan legge inn i ditt kalenderprogram.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                F3, F4 og F5?
              </h3>
              <p className="text-gray-600">
                Sjekk at du har fått dei fridagane du har krav på.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Statistikk og analyse
              </h3>
              <p className="text-gray-600">
                Få oversikt over arbeidstid, kveldsvakter, nattarbeid og meir.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Import/Eksport
              </h3>
              <p className="text-gray-600">
                Importer eksisterande turnusar eller eksporter til Excel/PDF.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Hjelpeturnus, Årsturnus og Grunnturnus
              </h3>
              <p className="text-gray-600">
                Har du nok feriedagar? Ferietimar? Kviletid? Kompenserande kvile?
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Lær om turnusplanlegging
            </h2>
            <p className="text-xl text-gray-600 mb-6">
              Les artiklar om arbeidsmiljøloven, tariffavtalar og beste praksis
            </p>
            <Link
              href="/blog"
              className="text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Sjå alle artiklar →
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {articles?.map(article => (
              <Link
                key={article.id}
                href={`/blog/${article.slug}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
                      {article.category}
                    </span>
                    {article.reading_time_minutes && (
                      <span>{article.reading_time_minutes} min</span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {article.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Våre Prisar
            </h2>
            <p className="text-xl text-gray-600">
              Les våre artiklar gratis eller abonner dersom du ynskjer å sjekke din turnus.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-lg shadow-md p-8 border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Artiklar</h3>
              <div className="text-4xl font-bold text-gray-900 mb-6">
                0 kr<span className="text-lg text-gray-600 font-normal"></span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-600">Kva er tidssone for raud dag?</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-600">Julafta på raud dag?</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-600">F4 og F3 på same dag?</span>
                </li>
              </ul>
              <Link
                href="/login"
                className="block w-full text-center bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Les gratis
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-indigo-600 rounded-lg shadow-xl p-8 text-white relative">
              <div className="absolute top-0 right-0 bg-yellow-400 text-gray-900 px-4 py-1 text-sm font-semibold rounded-bl-lg rounded-tr-lg">
                Populær
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-6">
                99 kr<span className="text-lg font-normal opacity-90">/månad</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Ubegrensa turnusar</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>KS, Spekter, AML, Oslo Kommune og meir</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Kalendervisning</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Lovsjekk med utdjuping</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Support</span>
                </li>
              </ul>
              <Link
                href="/login"
                className="block w-full text-center bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Test din turnus
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Klar til å lage din første turnus?
          </h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Prøv for 99kr/mnd. Kanseller når som helst.
          </p>
          <Link
            href="/login"
            className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Kom i gang no
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Turnusplanleggar</h3>
              <p className="text-gray-400 text-sm">
                Lag lovlege turnusar med automatiske sjekkar.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produkt</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#features" className="hover:text-white">Funksjonar</Link></li>
                <li><Link href="#pricing" className="hover:text-white">Prisar</Link></li>
                <li><Link href="/blog" className="hover:text-white">Artiklar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ressursar</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/blog/category/arbeidsmiljoloven" className="hover:text-white">Arbeidsmiljøloven</Link></li>
                <li><Link href="/blog/category/tariffavtalar" className="hover:text-white">Tariffavtalar</Link></li>
                <li><Link href="/blog/category/turnusplanlegging" className="hover:text-white">Planleggingsguider</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Selskap</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-white">Om oss</Link></li>
                <li><Link href="/contact" className="hover:text-white">Kontakt</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Personvern</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 Turnusplanleggar. Alle rettar reserverte.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}