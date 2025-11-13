// src/app/about/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AboutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-red-600 hover:text-red-700 transition-colors">
            Turnus-Hjelp
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/about" className="text-gray-600 hover:text-indigo-600 transition-colors">
              Om oss
            </Link>
            {user ? (
              <Link
                href="/app"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Mine turnusar
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-gray-600 hover:text-indigo-600 transition-colors">
                  Logg inn
                </Link>
                <Link
                  href="/signup"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Kom i gang
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Om Turnus-Hjelp
            </h1>
            <p className="text-xl text-gray-600">
              Din digitale assistent for turnusplanlegging
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 space-y-8">
            {/* What is Turnus-Hjelp */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Kva er Turnus-Hjelp?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Turnus-Hjelp er ein norsk teneste som gjer det enkelt å planlegge og administrere 
                turnusordningar. Vi hjelper deg med å lage oversiktlege turnusplanar som oppfyller 
                krava i arbeidsmiljølova og som tek omsyn til både arbeidsgivar og arbeidstakarar 
                sine behov.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Anten du jobbar i helsevesenet, industrien, eller andre bransjar med skift og turnus, 
                gir Turnus-Hjelp deg verktøya du treng for å skape effektive og rettferdige turnusplanar.
              </p>
            </section>

            {/* Why Turnus-Hjelp */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Kvifor velje Turnus-Hjelp?
              </h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Enkel å bruke</h3>
                    <p className="text-gray-700">
                      Intuitiv brukargrensesnitt som gjer det raskt å opprette og redigere turnusplanar.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Regelkonform</h3>
                    <p className="text-gray-700">
                      Innebygd støtte for arbeidsmiljølovens krav til kviletid, arbeidstid og fridagar.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Fleksibel planlegging</h3>
                    <p className="text-gray-700">
                      Lag eigne skifttypar og turnusmalar som passar akkurat din arbeidsplass.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Samarbeid</h3>
                    <p className="text-gray-700">
                      Del planar med kollegaer og få innspel før du ferdigstiller turnusen.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* How it works */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Korleis fungerer det?
              </h2>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Opprett ein brukar</h3>
                    <p className="text-gray-700">
                      Registrer deg gratis og kom i gang på få sekund.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Definer skifttypar</h3>
                    <p className="text-gray-700">
                      Lag skifttypar som passar din verksemd, med tilpassbare tider og eigenskapar.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Bygg turnusplanen</h3>
                    <p className="text-gray-700">
                      Dra og slepp skift inn i kalenderen, eller bruk våre smarte malar.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Eksporter og del</h3>
                    <p className="text-gray-700">
                      Eksporter til PDF eller Excel, eller del direkte med teamet ditt.
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            {/* Contact/Support */}
            <section className="bg-indigo-50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Treng du hjelp?
              </h2>
              <p className="text-gray-700 mb-4">
                Vi er her for å hjelpe deg! Sjå vår{' '}
                <Link href="/guide" className="text-indigo-600 hover:text-indigo-700 font-semibold">
                  guide
                </Link>
                {' '}for å komme i gang, eller ta kontakt med oss om du har spørsmål.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/guide"
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
                >
                  Les guiden
                </Link>
                {!user && (
                  <Link
                    href="/signup"
                    className="bg-white text-indigo-600 px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-semibold border-2 border-indigo-600"
                  >
                    Kom i gang gratis
                  </Link>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} Turnus-Hjelp. Alle rettar reserverte.</p>
        </div>
      </footer>
    </div>
  )
}