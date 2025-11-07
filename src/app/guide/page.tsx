import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Korleis sjekke turnusen din - Detaljert guide',
  description: 'Lær korleis du testar turnusen din mot arbeidsmiljøloven og tariffavtalar. Komplett guide frå start til slutt.'
}

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

    const steps = [
    {
      number: 1,
      title: 'Registrer deg og logg inn',
      description: 'Start med å opprette ein gratis konto. Du kan bruke Google-innlogging eller e-post.',
      image: '/images/guide/step1.png',
      details: 'Du treng ein konto for å lagre turnusane dine og få tilgang til lovsjekk-funksjonaliteten. Registrering tek berre 30 sekund.',
      tips: [
        'Bruk Google-innlogging for raskast tilgang',
        'Eller registrer med e-post og passord',
        'Du får ein bekreftelsese-post som du må klikke på',
        'Logg inn og du er klar til å starte'
      ]
    },
    {
      number: 2,
      title: 'Opprett ein ny turnusplan',
      description: 'Klikk på "Lag ny turnus".',
      image: '/images/guide/step2.png',
      tips: [
        'Trykk "+ Ny turnus" eller "Lag ny turnus" for å kome i gong'
      ]
    },
    {
      number: 3,
      title: 'Vel den turnusen du skal sjekke',
      image: '/images/guide/step3.png',
      tips: [
        'Vel namn på turnusen',
        'Vel type turnus.',
        'Set kor mange veker er turnussyklusen? (vanlegvis 6 eller 12 veker)',
        'Vel tariffavtale',
        'Set startdato (viktig for å rekne F3 og F5 dagar)',
        'Oppgi stillingsprosent'
      ]
    },
    {
      number: 4,
      title: 'Trykk Vakter',
      image: '/images/guide/step4.png',
      tips: [
        'Trykk på "Vakter for å starte'
      ]
    },
    {
      number: 5,
      title: 'Lag ny vakt',
      image: '/images/guide/step5.png',
      details: 'Dersom du har laga vakter fra før kan du importere frå ein anna turnus. (Sjå steg 16)',
      tips: [
        'Trykk "+ Ny vakt"'
      ]
    },
    {
      number: 6,
      title: 'Lag ny vakt',
      description: 'Fyll inn informasjon om vakta.',
      image: '/images/guide/step6.png',
      tips: [
        'Vel namn, start tidspunkt og slutt tidspunkt',
        'Trykk "Opprett vakt"',
      ]
    },
    {
      number: 7,
      title: 'Fyll inn turnusen',
      description: 'Fyll inn turnusen med dagvakter, kveldsvakter, langvakter og nattevakter.',
      image: '/images/guide/step7.png',
      tips: [
        'Trykk på ein av dagane du ynskjer å sette ei vakt på',
        'Du treng ikkje fylle inn F2 vakter'
      ]
    },
    {
      number: 8,
      title: 'Vel kva vakt du vil fylle inn',
      description: 'Vel mellom alle vaktene som du har laga eller forhandslaga (F1-F5).',
      image: '/images/guide/step8.png',
      tips: [
        'F3, F4 og F5 er kun brukt i hjelpeturnus og årsturnus',
        'F1 fyllast inn på same måte som andre vakter'
      ]
    },
    {
      number: 9,
      title: 'Lovsjekk',
      description: 'Når turnusen er ferdig utfylt, er det på tide å sjekke om den følgjer alle lover og reglar.',
      image: '/images/guide/step9.png',
      tips: [
        'Når du er ferdig å har sjekka at turnusen stemmer er du klar',
        'Klikk på "Lovsjekk"-fana øvst på plansida'
      ]
    },
    {
      number: 10,
      title: 'Kjør lovsjekk',
      description: 'Kjør dei lovsjekkane du ynskjer.',
      image: '/images/guide/step10.png',
      details: 'Før du kjører lovsjekk må du hake av og skrive inn det som står i dykkar turnusavtale og rammeavtale',
      tips: [
        'Kjør alle du har haka av',
        'Eller kjør kvar enkelt kvar for seg'
      ]
    },
    {
      number: 11,
      title: 'Les gjennom lovsjekkresultata',
      description: 'No får du ein detaljert rapport om turnusen din følgjer lova, og kva som eventuelt som må rettast.',
      image: '/images/guide/step11.png',
      tips: [
        '🟢 **Grønt = Pass**: Denne regelen er følgd korrekt',
        '🔴 **Raudt = Fail**: Brudd på lova - må rettast!',
        '🟡 **Gult = Warning**: Bør sjekkas, men ikkje naudsynt lovbrudd',
        'Klikk på kvar sjekk for å få detaljert forklaring',
        'Systemet viser kvar i turnusen problemet er'
      ]
    },
    {
      number: 12,
      title: 'Spesielt om årsturnus',
      description: 'Rotasjonsbasert årsturnus er når ein lagar ein "grunnturnus" og rullerar denne ut i 52 veker.' ,
      image: '/images/guide/aarsturnus_step1.png',
      tips: [
        'Lag årsturnus',
        'Vel kor mange veker "grunnturnusen" varar',
        'Årsturnusen blir automatisk oppretta',
        'Årsturnus fungerar som ein hjelpeturnus. Dette gjer den også for arbeidsgjevar.'
      ]
    },
    {
      number: 13,
      title: 'Bytt til årsturnus',
      description: 'Bytt til årsturnus for å kjøre lovsjekk.',
      image: '/images/guide/aarsturnus_step2.png',
      details: 'Du må fyrst lage grunnturnus slik som i steg 4-8.',
      tips: [
        'Du kan kjøre lovsjekk på "grunnturnusen" men denne er kun eit utgangspunkt',
        'Det er "grunnturnusen" si utforming som gjer krav på F3 og F5'
      ]
    },
    {
      number: 14,
      title: 'Importer grunnturnus',
      description: 'Importer grunnturnus .',
      image: '/images/guide/aarsturnus_step3.png',
      tips: [
        'Importer vakter og grunnturnus inn i årsturnus'
      ]
    },
    {
      number: 15,
      title: 'Importer',
      description: 'Importer vakter og turnus.',
      image: '/images/guide/aarsturnus_step4.png',
      details: 'OBS! Du må endre den etter importering. Alt vil ikkje stemme 100%. Det er slik arbeidsgjevar også jobbar.',
      tips: [
        'Importer vakter og turnus',
        'Trykk F5 dersom den ikkje blir oppdatert automatisk',
      ]
    },
    {
      number: 16,
      title: 'Importer vakter',
      description: 'Dersom du har laga vakter du har tenkt å bruke frå før kan du importere dei her.',
      image: '/images/guide/importer_vakter_step1.png',
      tips: [
        'Importer vakter frå anna turnus'
      ]
    },
    {
      number: 17,
      title: 'Importer vakter',
      description: 'Dersom du har laga vakter du har tenkt å bruke frå før kan du importere dei her.',
      image: '/images/guide/importer_vakter_step2.png',
      tips: [
        'Velg turnus',
        'Hak av enkelte eller velg alle',
        'Gå neste'
      ]
    }
  ]


  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                Turnusplanleggar
              </Link>
              <Link href="/" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">
                ← Tilbake til hovudsida
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Link
                  href="/app"
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-all hover:shadow-lg"
                >
                  Gå til app
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-all hover:shadow-lg"
                >
                  Kom i gang
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section id="steps" className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Steg-for-steg (trykk for å utvide)</h2>

            <div className="grid gap-4">
              {steps.map((step) => (
                <details
                  key={step.number}
                  className="group border border-gray-200 rounded-lg overflow-hidden bg-white transition-shadow shadow-sm"
                >
                  <summary className="flex items-center gap-4 cursor-pointer p-3 md:p-4 list-none">
                    <div className="w-32 h-24 flex-shrink-0 rounded-md overflow-hidden border border-gray-100">
                      <img src={step.image} alt={step.title} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center font-semibold">{step.number}</div>
                          <div className="text-sm font-semibold text-gray-900 truncate">{step.title}</div>
                        </div>
                        <div className="text-xs text-gray-500 hidden sm:block">Les meir ▸</div>
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-1">{step.description}</p>
                    </div>
                  </summary>

                  <div className="p-6 border-t border-gray-100 bg-white">
                    <div className="md:flex md:items-start md:gap-6">
                      <div className="md:w-1/2 mb-4 md:mb-0">
                        <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-100">
                          <img src={step.image} alt={step.title} className="w-full h-full object-cover" />
                        </div>
                      </div>

                      <div className="md:flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                        {step.details && (
                          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
                            <p className="text-gray-700">{step.details}</p>
                          </div>
                        )}

                        <div className="mb-4">
                          <p className="text-gray-700 mb-3">{step.description}</p>

                          <ul className="grid gap-2 sm:grid-cols-2">
                            {step.tips?.map((tip, i) => (
                              <li key={i} className="text-sm text-gray-600 leading-relaxed">• {tip.replace(/\*\*(.*?)\*\*/g, '$1')}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
