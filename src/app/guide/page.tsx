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
      image: '/images/slideshow/my_plans.png',
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
      description: 'Klikk på "Lag ny turnus" og fyll inn grunnleggjande informasjon om turnusen din.',
      image: '/images/slideshow/my_plans.png',
      details: 'Her legg du inn metadata om turnusen din som systemet treng for å gjere korrekte lovsjekkar.',
      tips: [
        'Vel **type turnus**: Hovudturnus (din eigen) eller Hjelpeturnus (ekstravakter til hovudturnus)',
        'Set **varigheit**: Kor mange veker er turnussyklusen? (vanlegvis 6-8 veker)',
        'Vel **tariffavtale**: KS, Staten, Oslo kommune, Spekter eller berre AML',
        'Set **startdato**: Når startar turnussyklusen din?',
        'Oppgi **stillingsprosent**: 100%, 80%, 75% osv.',
        'Gje turnusen eit beskrivande namn, t.d. "Min turnus 2025" eller "Vårturnus 6v"'
      ]
    },
    {
      number: 3,
      title: 'Definer vaktene du bruker',
      description: 'Før du kan fylle inn turnusen, må du definere kva typer vakter som finst i din turnus.',
      image: '/images/slideshow/shifts.png',
      details: 'Dette er vaktane som du allereie har i din eksisterande turnus på papiret eller i Excel. No skal du legge dei inn i systemet.',
      tips: [
        '**F1-F5 er ferdigdefinerte**: F1=Fridag, F2=Natt (skal erstattast av nattvakt), F3/F4/F5=Spesielle fridagar',
        '**Lag eigne vakter**: Klikk "Opprett vakt" for å lage dine eigne vakter',
        '**Dagvakt**: T.d. "Dag 07:30-15:30" eller "D 08:00-16:00"',
        '**Kveldsvakt**: T.d. "Kveld 15:00-23:00" eller "K 14:30-22:30"',
        '**Nattevakt**: T.d. "Natt 23:00-07:30" eller "N 22:45-07:15"',
        '**Langvakt**: T.d. "Lang 07:30-21:30" eller "L 08:00-20:00"',
        'Gje kvar vakt eit tydeleg namn og eksakte start-/slutt-tider',
        'Tider som går over midnatt (t.d. 23:00-07:30) håndterast automatisk'
      ]
    },
    {
      number: 4,
      title: 'Fyll inn turnusen din veke for veke',
      description: 'No er det på tide å overføre turnusen din frå papiret/Excel inn i systemet. Gå gjennom kvar veke og kvar dag.',
      image: '/images/slideshow/turnus_80_total.png',
      details: 'Ta fram den eksisterande turnusen din (papir, PDF, Excel osv) og fyll inn nøyaktig kva vakter du har kvar dag. Dette er hovudsteget der du bruker mest tid.',
      tips: [
        '**Klikk på kvar rute** i turnusgridet for å velje vakt for den dagen',
        '**Måndag til søndag**: Kolonnane viser vekedag, radene viser veke nr',
        '**Bruk F1 for fridagar**: Marker alle fridagar med F1',
        '**Erstatt F2 med nattvakt**: Om du har nattvakter, bruk din definerte nattvakt i staden for F2',
        '**Vær nøyaktig**: Systemet sjekkar nøye, så fyll inn alt korrekt',
        '**Kopierfunksjon**: Om du har repeterende mønster, kan du kopiere heile veker',
        '**Dobbeltsjekk**: Gå gjennom alt ein gong til før du går vidare',
        'Om du har hjelpeturnus, opprett både hovudturnus og hjelpeturnus separat'
      ]
    },
    {
      number: 5,
      title: 'Spesielle fridagar (F3, F4, F5)',
      description: 'F3, F4 og F5 er spesielle fridagar som du får som kompensasjon for helge-/høgtidsarbeid. Desse må du markere separat.',
      image: '/images/slideshow/turnus_80_total.png',
      details: 'Arbeidsmiljøloven og tariffavtalar seier at du skal få ekstra fridagar om du jobbar på visse dagar. Systemet sjekkar om du har fått desse.',
      tips: [
        '**F3 (Helgedagsfri)**: Fridag etter arbeid på helge- eller høgtidsdagar',
        '**F4 (Lørdagsfri)**: Kompensasjon for laugdagsarbeid (visse tariffavtalar)',
        '**F5 (Erstatningsfridag)**: Når F1 (ukefridag) fell på laurdag/søndag/høgtidsdag',
        'Klikk på ruta og vel F3, F4 eller F5 når du har slike fridagar',
        'Om du er usikker på om du har F3/F5, vent til lovsjekken - den vil vise deg om du manglar nokon',
        'Systemet reknar ut automatisk kor mange F3/F5 du *skal* ha, og samanliknar med kva du har lagt inn'
      ]
    },
    {
      number: 6,
      title: 'Marker ferie og permisjonar',
      description: 'Om turnusen din inkluderer ferieveker eller permisjonsdagar, skal desse markerast.',
      image: '/images/slideshow/turnus_80_total.png',
      details: 'Ferie og permisjoner er viktige for at lovsjekken skal vere korrekt. Systemet må vite kva som er planlagd arbeid og kva som er ferie.',
      tips: [
        'Klikk på rutene der du har ferie/permisjon',
        'Vel "Ferie" eller "Permisjon" frå dropdown-menyen',
        'Heile veker med ferie kan markerast på ein gong',
        'Sjukdom skal IKKJE markerast - berre planlagd ferie',
        'Feriedagar tel med i berekningar av årsarbeidstid',
        'Om du har 5 veker ferie i året, skal det vere med i turnusplanen'
      ]
    },
    {
      number: 7,
      title: 'Gå til lovsjekk-sida',
      description: 'Når turnusen er ferdig utfylt, er det på tide å sjekke om han følgjer alle lover og reglar.',
      image: '/images/slideshow/lovsjekk_fail.png',
      details: 'Dette er hovudfunksjonen i systemet - automatisk sjekk mot Arbeidsmiljøloven og din tariffavtale.',
      tips: [
        'Klikk på "Lovsjekk"-fana øvst på plansida',
        'Systemet vil automatisk køyre alle relevante sjekkar',
        'Dette tek berre nokre sekund',
        'Du får umiddelbar tilbakemelding på alle brudd'
      ]
    },
    {
      number: 8,
      title: 'Les gjennom lovsjekkresultata',
      description: 'No får du ein detaljert rapport om turnusen din følgjer lova, og kva som eventuelt må rettast.',
      image: '/images/slideshow/lovsjekk_fail.png',
      details: 'Systemet kjører 15+ ulike sjekkar mot Arbeidsmiljøloven og den tariffavtalen du valde. Kvar sjekk viser status: pass (grønt), fail (raudt) eller warning (gult).',
      tips: [
        '🟢 **Grønt = Pass**: Denne regelen er følgd korrekt',
        '🔴 **Raudt = Fail**: Brudd på lova - må rettast!',
        '🟡 **Gult = Warning**: Bør sjekkas, men ikkje naudsynt lovbrudd',
        'Klikk på kvar sjekk for å få detaljert forklaring',
        'Systemet viser EKSAKT kvar i turnusen problemet er',
        'Nokon sjekkar gjeld berre for visse tariffavtalar'
      ]
    },
    {
      number: 9,
      title: 'Forstå dei ulike lovsjekane',
      description: 'Systemet sjekkar 15+ ulike reglar. Her er dei viktigaste:',
      image: '/images/slideshow/lovsjekk_fail.png',
      details: 'Kvar sjekk har ein tittel, beskrivelse, og lenke til relevant lovparagraf. Les nøye gjennom kva som sjekkast.',
      tips: [
        '**3-delt snitt**: Har du rett til 33,6 eller 35,5 timars veke? Basert på nattarbeid, søndagsarbeid og døgnkontinuerleg drift',
        '**Dagleg og ukentleg arbeidsfri (§10-8)**: 11 timar dagleg kvile + 35 timar ukentleg kvile',
        '**Kompenserande kvile**: Om du bryt kvilereglane, må du få kompensasjon seinare',
        '**F1 kviletid**: Har ukefridagen (F1) minimum 35 timar kvile før OG etter?',
        '**F3 helgedagsfridagar**: Får du fridagar etter arbeid på søndag/høgtidsdagar?',
        '**F5 erstatningsfridag**: Får du ny fridag når F1 fell på laurdag/søndag?',
        '**Ferie**: Har du fått riktig antal ferieveker og ferietimar basert på stillingsprosent?',
        '**Gjennomsnittsberekningar**: Over 8/13/26 veker - stemmer gjennomsnittleg arbeidstid?',
        '**Maksimal arbeidstid**: Ikkje meir enn 9/10/13 timar per dag (avhengig av situasjon)',
        'Kvar sjekk har lenke til Lovdata for å lese den faktiske lova'
      ]
    },
    {
      number: 10,
      title: 'Rett opp feil i turnusen',
      description: 'Om du fekk raude (fail) resultat, må du rette opp i turnusen.',
      image: '/images/slideshow/turnus_80_total.png',
      details: 'Gå tilbake til turnusgridet og gjer endringar basert på tilbakemeldingane frå lovsjekken.',
      tips: [
        'Klikk på "Turnus"-fana for å gå tilbake til redigeringsmodus',
        'Finn dei dagane/vekene der systemet viste problem',
        'Gjer naudsynte endringar (flytt vakter, legg til fridagar osv.)',
        'Gå tilbake til lovsjekk og sjekk på nytt',
        'Gjenta til alle sjekkane er grøne (eller i det minste gule)',
        '**Viktig**: Nokon gonger må du endre fleire veker for å få alt til å stemme'
      ]
    },
    {
      number: 11,
      title: 'Forstå F3 og F5 korrekt',
      description: 'Dei vanlegaste feila handlar om F3 og F5 fridagar. La oss forklare desse i detalj.',
      image: '/images/slideshow/lovsjekk_fail.png',
      details: 'F3 og F5 er spesielle fridagar som mange ikkje veit at dei har krav på. Systemet hjelper deg med å berekne kor mange du skal ha.',
      tips: [
        '**F3 - Helgedagsfri**: Om du jobbar på ein søndag eller høgtidsdag, skal du få ein ekstra fridag etterpå',
        'Eksempel: Jobbar søndag veke 2 → skal ha F3 seinare i turnusen',
        '**F5 - Erstatningsfridag**: Om din vanlege ukefridag (F1) fell på laurdag, søndag eller høgtidsdag, skal du få F5 ein annan dag',
        'Eksempel: F1 er laurdag veke 3 → skal ha F5 ein annan dag i staden',
        'Systemet tel automatisk opp kor mange F3 og F5 du *skal* ha',
        'Samanliknar så med kor mange du faktisk har lagt inn',
        'Om talet ikkje stemmer, får du beskjed om å legge til fleire F3/F5',
        'Les paragrafen din tariffavtale for eksakte reglar - dei varierer litt'
      ]
    },
    {
      number: 12,
      title: 'Test med ulike tariffavtalar',
      description: 'Om du er usikker på kva tariffavtale som gjeld for deg, kan du teste med fleire.',
      image: '/images/slideshow/my_plans.png',
      details: 'Ulike tariffavtalar har litt ulike reglar. Systemet sjekkar automatisk dei rette reglane basert på valet ditt.',
      tips: [
        'Gå til "Rediger plan" og bytt tariffavtale',
        'Køyr lovsjekk på nytt med den nye tariffavtalen',
        'Samanlikn resultata',
        '**KS**: Kommunesektoren - dei fleste sjukepleiarar og helsepersonell i kommunen',
        '**Staten**: Statleg tilsette, t.d. på statleg sjukehus',
        '**Oslo**: Oslo kommune har eigen tariffavtale',
        '**Spekter**: Private/offentlege helseføretak',
        '**Berre AML**: Om du ikkje har tariffavtale, vel denne',
        'Systemet viser berre relevante sjekkar for din tariffavtale'
      ]
    },
    {
      number: 13,
      title: 'Test hjelpeturnus mot hovudturnus',
      description: 'Dersom du har ekstravakter (hjelpeturnus) i tillegg til din faste turnus, kan du teste desse saman.',
      image: '/images/slideshow/turnus_80_total.png',
      details: 'Mange har ein hovudturnus PLUSS ekstravakter. Systemet kan sjekke at kombinasjonen er lovleg.',
      tips: [
        'Opprett først hovudturnusen din (type: "Hovudturnus")',
        'Opprett så ein ny plan (type: "Hjelpeturnus")',
        'Ved oppretting av hjelpeturnus, vel hovudturnusen som "baseplan"',
        'Fyll inn ekstravaktene i hjelpeturnusen',
        'Systemet vil sjekke kombinasjonen av begge turnusane',
        'Kritisk: Kviletid mellom hovudturnus og hjelpeturnus må vere lovleg',
        'Du får beskjed om det oppstår konflikt mellom turnusane'
      ]
    },
    {
      number: 14,
      title: 'Eksporter til kalender',
      description: 'Når turnusen er godkjent, kan du eksportere han til kalenderen din.',
      image: '/images/slideshow/my_plans.png',
      details: 'Få turnusen din automatisk inn i Google Calendar, Outlook eller Apple Calendar.',
      tips: [
        'Gå til "Kalender"-fana',
        'Klikk "Eksporter til kalender"',
        'Vel format: iCal (.ics), Google Calendar eller Outlook',
        'Opne fila eller kopier lenka',
        'Turnusen blir automatisk lagt inn i kalenderen din',
        'Du kan no sjå alle vaktene dine på telefonen',
        'Oppdateringar du gjer i systemet kan eksporterast på nytt',
        'Du kan dele kalenderlenka med kolleger'
      ]
    },
    {
      number: 15,
      title: 'Lagre og administrer fleire turnusar',
      description: 'Du kan lage ubegrensa antal turnusplanar. Perfekt for testing av alternativ.',
      image: '/images/slideshow/my_plans.png',
      details: 'Kanskje du vil teste fleire variasjonar? Eller du har både sommar- og vinterturnus? Lag så mange du vil.',
      tips: [
        'Kvar turnus blir automatisk lagra',
        'Gå til hovudsida for å sjå alle turnusane dine',
        'Klikk "Dupliser" for å lage ein kopi av ein eksisterande turnus',
        'Nyttig for å teste "kva om"-scenarioar',
        'Eksempel: Test same turnus med 80% vs 100% stilling',
        'Slett turnusar du ikkje treng lenger',
        'All data er trygt lagra i skya'
      ]
    },
    {
      number: 16,
      title: 'Statistikk og analyse',
      description: 'Sjå detaljert statistikk om turnusen din - total arbeidstid, nattarbeid, helgearbeid osv.',
      image: '/images/slideshow/turnus_80_total.png',
      details: 'Systemet bereknar automatisk viktig statistikk som hjelper deg med å forstå turnusen din.',
      tips: [
        'Total arbeidstimar i heile turnussyklusen',
        'Gjennomsnittleg arbeidstid per veke',
        'Antal nattevakter',
        'Antal helgevakter',
        'Antal fridagar (F1, F3, F4, F5)',
        'Lengste arbeidsperiode utan fridag',
        'Kortaste kviletid mellom vakter',
        'Ferieoversikt',
        'Bruk denne statistikken til å samanlikne ulike turnusalternativ'
      ]
    },
    {
      number: 17,
      title: 'Få hjelp og support',
      description: 'Står du fast eller har spørsmål? Vi er her for å hjelpe!',
      image: '/images/slideshow/my_plans.png',
      details: 'Turnusplanlegging og lovgiving kan vere komplisert. Ikkje nøl med å spørje om hjelp.',
      tips: [
        'Les våre gratis bloggartikar om arbeidsmiljøloven',
        'Sjekk FAQ-seksjonen på sida',
        'Send e-post til support@turnus-hjelp.no',
        'Facebook-gruppe: "Turnusplanlegging hjelp" (kommer snart)',
        'Meld feil eller forslag til forbetring',
        'Vi svarer vanlegvis innan 24 timar',
        'Juridiske spørsmål? Vi anbefaler å kontakte fagforeninga di eller advokat'
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
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

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              📚 Komplett guide · {steps.length} steg
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Korleis teste turnusen din mot <span className="text-indigo-600">arbeidsmiljøloven</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Detaljert steg-for-steg guide for å sjekke om turnusen din (som du allereie har) 
              følgjer alle lover og reglar. Perfekt for sjukepleiarar, helsepersonell og andre turnusarbeidarar.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link
                  href="/app"
                  className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-all hover:shadow-xl"
                >
                  Start no →
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-all hover:shadow-xl"
                  >
                    Kom i gang gratis
                  </Link>
                  <Link
                    href="#steps"
                    className="bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-all border-2 border-indigo-600"
                  >
                    Les guiden først
                  </Link>
                </>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-6">
              ⏱️ Les gjennom: ~10 minutt · Test turnus: ~15-20 minutt
            </p>
          </div>
        </div>
      </section>

      {/* Floating "Jump to step" button */}
      <div className="fixed bottom-8 right-8 z-50">
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-all hover:scale-110 flex items-center justify-center">
              <svg className="w-6 h-6 group-open:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg className="w-6 h-6 hidden group-open:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </summary>
          <div className="absolute bottom-20 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 w-80 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 bg-indigo-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Hopp til steg
              </h3>
              <p className="text-xs text-gray-600 mt-1">{steps.length} steg totalt</p>
            </div>
            <div className="p-2">
              {steps.map((step) => (
                <a
                  key={step.number}
                  href={`#step-${step.number}`}
                  className="block text-sm text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded transition-all"
                >
                  <span className="font-semibold text-indigo-600">{step.number}.</span> {step.title}
                </a>
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* Steps Section */}
      <section id="steps" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-20">
            {steps.map((step, index) => (
              <div 
                key={step.number} 
                id={`step-${step.number}`}
                className="scroll-mt-32"
              >
                {/* Step Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                  {/* Step Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center font-bold text-2xl">
                            {step.number}
                          </div>
                          <div className="text-sm opacity-90">
                            Steg {step.number} av {steps.length}
                          </div>
                        </div>
                        <h2 className="text-3xl font-bold mb-3">
                          {step.title}
                        </h2>
                        <p className="text-xl text-indigo-100">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step Content */}
                  <div className="p-8">
                    {/* Details */}
                    {step.details && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg mb-6">
                        <div className="flex items-start gap-3">
                          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-gray-700 leading-relaxed">{step.details}</p>
                        </div>
                      </div>
                    )}

                    {/* Screenshot */}
                    {step.image && (
                      <div className="mb-8">
                        <div className="relative rounded-xl overflow-hidden shadow-lg border border-gray-200">
                          <img
                            src={step.image}
                            alt={step.title}
                            className="w-full h-auto"
                          />
                        </div>
                      </div>
                    )}

                    {/* Tips */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                      <div className="flex items-center gap-3 mb-4">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <h3 className="text-xl font-bold text-gray-900">
                          {step.tips.length === 1 ? 'Tips' : `${step.tips.length} viktige punkt`}
                        </h3>
                      </div>
                      <ul className="space-y-3">
                        {step.tips.map((tip, tipIndex) => (
                          <li key={tipIndex} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>') }} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Next Step Arrow */}
                {index < steps.length - 1 && (
                  <div className="flex items-center justify-center mt-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-sm text-gray-500 font-medium">Neste steg</div>
                      <a 
                        href={`#step-${step.number + 1}`}
                        className="flex flex-col items-center gap-2 hover:scale-110 transition-transform"
                      >
                        <div className="w-1 h-12 bg-gradient-to-b from-indigo-200 to-indigo-400"></div>
                        <svg className="w-8 h-8 text-indigo-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Summary Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 md:p-12 border border-indigo-100">
              <div className="text-center mb-8">
                <div className="inline-block bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                  ✅ Gratulerer!
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Du er no klar til å teste turnusen din!
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  Følg stega over, fyll inn turnusen din nøyaktig, og få automatisk tilbakemelding 
                  på om han følgjer alle lover og reglar.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg p-6 text-center shadow-md">
                  <div className="text-4xl font-bold text-indigo-600 mb-2">10-15</div>
                  <div className="text-sm text-gray-600">minutt å fylle inn</div>
                </div>
                <div className="bg-white rounded-lg p-6 text-center shadow-md">
                  <div className="text-4xl font-bold text-indigo-600 mb-2">15+</div>
                  <div className="text-sm text-gray-600">automatiske lovsjekkar</div>
                </div>
                <div className="bg-white rounded-lg p-6 text-center shadow-md">
                  <div className="text-4xl font-bold text-indigo-600 mb-2">0 kr</div>
                  <div className="text-sm text-gray-600">de første 7 dagane</div>
                </div>
              </div>

              <div className="text-center">
                {user ? (
                  <Link
                    href="/app"
                    className="inline-block bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-all hover:shadow-xl"
                  >
                    Gå til appen no →
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="inline-block bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-all hover:shadow-xl"
                  >
                    Kom i gang gratis →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Ofte stilte spørsmål
              </h2>
              <p className="text-xl text-gray-600">
                Svar på dei vanlegaste spørsmåla
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  question: 'Må eg allereie ha ein ferdig turnus?',
                  answer: 'Ja! Dette verktøyet er for å TESTE turnusen du allereie har (på papir, PDF, Excel osv). Du fyller inn den eksisterande turnusen din, og systemet sjekkar om han følgjer lova.'
                },
                {
                  question: 'Kan systemet lage ein turnus for meg?',
                  answer: 'Nei, dette er ikkje ein turnusgenererator. Du må ha ein ferdig turnus som du vil teste. Systemet hjelper deg med å sjekke om han er lovleg, men lagar han ikkje for deg.'
                },
                {
                  question: 'Kva om turnusen min ikkje består lovsjekken?',
                  answer: 'Du får detaljert tilbakemelding om kva som er feil og korleis du kan rette det. Du kan då endre turnusen (snakke med arbeidsgjevar) og teste på nytt.'
                },
                {
                  question: 'Er systemet juridisk bindande?',
                  answer: 'Nei. Systemet gir gode indikasjonar på om turnusen følgjer lova, men er ikkje juridisk rådgjeving. Ved tvil, kontakt fagforening eller advokat.'
                },
                {
                  question: 'Kostar det noko?',
                  answer: 'Du får 7 dagar gratis prøveperiode. Deretter kostar det 49 kr/månad. Du kan kansellere når som helst.'
                },
                {
                  question: 'Kva tariffavtalar støttast?',
                  answer: 'Vi støttar KS (kommunesektoren), Staten, Oslo kommune, Spekter (helseføretak), og generell Arbeidsmiljølov utan tariffavtale.'
                },
                {
                  question: 'Kan eg teste fleire turnusar?',
                  answer: 'Ja! Du kan lage ubegrensa antal turnusplanar. Perfekt for å teste ulike alternativ eller samanlikne sommar- og vinterturnusar.'
                },
                {
                  question: 'Kor lang tid tek det?',
                  answer: 'Å fylle inn ein 6-vekers turnus tek vanlegvis 10-15 minutt. Lovsjekken skjer automatisk og tek berre nokre sekund.'
                }
              ].map((faq, index) => (
                <details
                  key={index}
                  className="group bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <summary className="cursor-pointer p-6 font-semibold text-gray-900 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <span>{faq.question}</span>
                    <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Klar til å teste turnusen din?
          </h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            {user 
              ? 'Gå til appen og start med å legge inn turnusen din!'
              : 'Start gratis i dag. Ingen kredittkort påkravd.'}
          </p>
          <Link
            href={user ? '/app' : '/login'}
            className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-all hover:shadow-2xl"
          >
            {user ? 'Gå til appen' : 'Kom i gang gratis'}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Turnusplanleggar</h3>
              <p className="text-gray-400 text-sm">
                Test turnusen din mot arbeidsmiljøloven og tariffavtalar.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produkt</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/" className="hover:text-white transition-colors">Hovudside</Link></li>
                <li><Link href="/guide" className="hover:text-white transition-colors">Guide</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Artiklar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ressursar</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/blog" className="hover:text-white transition-colors">Arbeidsmiljøloven</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Tariffavtalar</Link></li>
                <li><Link href="/guide" className="hover:text-white transition-colors">Bruksrettleiing</Link></li>
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
            <p>&copy; 2025 Turnusplanleggar. Alle rettar reserverte.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}