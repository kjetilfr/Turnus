// src/app/privacy/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function PrivacyPage() {
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
              Personvernpolicy
            </h1>
            <p className="text-xl text-gray-600">
              Sist oppdatert: {new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Innleiing
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Turnus-Hjelp tek personvernet ditt på alvor. Denne personvernpolicyen forklarer korleis 
                vi samlar inn, bruker, deler og beskyttar personopplysningane dine når du bruker tenesta vår.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Ved å bruke Turnus-Hjelp godtek du vilkåra i denne personvernpolicyen. Om du ikkje er 
                einig i vilkåra, ber vi deg om å ikkje bruke tenesta.
              </p>
            </section>

            {/* Data Collection */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Kva opplysningar samlar vi inn?
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Kontoinformasjon</h3>
                  <p className="text-gray-700">
                    Når du opprettar ein konto, samlar vi inn e-postadresse, namn og passord (kryptert). 
                    Dette er nødvendig for å identifisere deg og gi deg tilgang til tenesta.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Turnusdata</h3>
                  <p className="text-gray-700">
                    Vi lagrar turnusplanane du lagar, inkludert skifttypar, arbeidstakarar, og andre 
                    opplysningar du legg inn i systemet. Dette er nødvendig for å levere tenesta.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Bruksdata</h3>
                  <p className="text-gray-700">
                    Vi samlar inn informasjon om korleis du bruker tenesta, inkludert IP-adresse, 
                    nettlesar type, og tidspunkt for innlogging. Dette hjelper oss med å forbetre tenesta 
                    og sikre tryggleik.
                  </p>
                </div>
              </div>
            </section>

            {/* Data Usage */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Korleis bruker vi opplysningane?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi bruker dei innsamla opplysningane til følgjande formål:
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">Å levere og vedlikehalde tenesta vår</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">Å forbetre og personalisere brukaropplevinga</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">Å kommunisere med deg om oppdateringar og endringar</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">Å sikre tryggleik og førebygge misbruk</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">Å overholde lovpålagde plikter</p>
                </div>
              </div>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Deler vi opplysningane dine?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi sel aldri personopplysningane dine. Vi deler berre opplysningar i følgjande tilfelle:
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Med ditt samtykke</h3>
                  <p className="text-gray-700">
                    Når du vel å dele turnusplanar med kollegaer eller andre brukarar, deler vi 
                    den informasjonen du har valt å dele.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Tenesteytarar</h3>
                  <p className="text-gray-700">
                    Vi bruker pålitelege tredjeparts tenesteytarar (t.d. hosting og database) som hjelper 
                    oss med å levere tenesta. Desse har tilgang til opplysningar berre i den grad det er 
                    nødvendig for å utføre oppgåvene sine.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Lovpålagt utlevering</h3>
                  <p className="text-gray-700">
                    Vi kan dele opplysningar om det er påkravd av lov, rettsprosess, eller offentlege myndigheiter.
                  </p>
                </div>
              </div>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Korleis sikrar vi dataa dine?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi tek dattryggleik på alvor og bruker ulike sikkerhetstiltak:
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">SSL/TLS-kryptering for all dataoverføring</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">Krypterte passord med moderne algoritmar</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">Regelmessige sikkerheitsoppdateringar og testing</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-700">Tilgangskontroll og autentisering</p>
                </div>
              </div>
            </section>

            {/* User Rights */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Dine rettar
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                I samsvar med GDPR og norsk personvernlovgivning har du følgjande rettar:
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Rett til innsyn</h3>
                  <p className="text-gray-700">
                    Du har rett til å få informasjon om kva personopplysningar vi har om deg.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Rett til retting</h3>
                  <p className="text-gray-700">
                    Du kan be oss om å rette feil eller ukomplette opplysningar.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Rett til sletting</h3>
                  <p className="text-gray-700">
                    Du kan be om at vi slettar personopplysningane dine. Dette kan du gjere ved å slette 
                    kontoen din i innstillingane.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Rett til dataportabilitet</h3>
                  <p className="text-gray-700">
                    Du kan be om å få utlevert personopplysningane dine i eit strukturert og maskinlesbart format.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Rett til å trekke tilbake samtykke</h3>
                  <p className="text-gray-700">
                    Dersom behandlinga er basert på samtykke, kan du når som helst trekke tilbake samtykket ditt.
                  </p>
                </div>
              </div>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Informasjonskapslar (cookies)
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi bruker informasjonskapslar for å forbetre brukaropplevinga og for å halde deg innlogga. 
                Informasjonskapslane vi bruker er:
              </p>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Nødvendige informasjonskapslar</h3>
                  <p className="text-gray-700">
                    Disse er nødvendige for at nettstaden skal fungere og kan ikkje slåast av.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Funksjonelle informasjonskapslar</h3>
                  <p className="text-gray-700">
                    Hjelper oss med å hugse innstillingane dine og personalisere opplevinga.
                  </p>
                </div>
              </div>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Kor lenge lagrar vi dataa?
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Vi lagrar personopplysningane dine så lenge du har ein aktiv konto. Når du slettar kontoen 
                din, vil vi slette eller anonymisere personopplysningane dine innan 30 dagar, med unntak 
                av opplysningar vi er forplikta til å oppbevare etter lov (t.d. for rekneskapsformål).
              </p>
            </section>

            {/* Children */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Born sin personvern
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Turnus-Hjelp er ikkje berekna for born under 18 år. Vi samlar ikkje medvite inn 
                personopplysningar frå born. Om du er føresett og oppdagar at barnet ditt har gitt oss 
                personopplysningar, ta kontakt med oss.
              </p>
            </section>

            {/* Changes */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Endringar i personvernpolicyen
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Vi kan oppdatere denne personvernpolicyen frå tid til anna. Endringar blir publisert 
                på denne sida med oppdatert dato. Vi oppmodar deg til å sjå gjennom policyen regelmessig.
              </p>
            </section>

            {/* Contact */}
            <section className="bg-indigo-50 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Kontakt oss
              </h2>
              <p className="text-gray-700 mb-4">
                Om du har spørsmål om denne personvernpolicyen eller korleis vi behandlar 
                personopplysningane dine, kan du kontakte oss:
              </p>
              <div className="space-y-2 text-gray-700">
                <p>
                  <strong>E-post:</strong> kontakt@turnus-hjelp.no
                </p>
                <p className="text-sm text-gray-600 mt-4">
                  Du har også rett til å klage til Datatilsynet om du meiner vi ikkje behandlar 
                  personopplysningane dine i samsvar med lova.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/about" className="hover:text-indigo-600 transition-colors">
              Om oss
            </Link>
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">
              Personvern
            </Link>
            <Link href="/terms" className="hover:text-indigo-600 transition-colors">
              Vilkår
            </Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Turnus-Hjelp. Alle rettar reserverte.</p>
        </div>
      </footer>
    </div>
  )
}