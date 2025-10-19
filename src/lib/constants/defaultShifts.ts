// src/lib/constants/defaultShifts.ts

export const DEFAULT_SHIFT_DESCRIPTIONS = {
  F1: 'Ukefridag er den lovbestemte ukentlige fridagen etter aml § 10-8 (2). Slik fridag skal strekke seg over 35 timer i løpet av sju dager, evt. 28 timer dersom det er avtalt unntak iht. aml § 10-8 (3). Disse fridager skal være innarbeidet i den løpende turnusplanen.',
  F2: 'Fridag som oppstår ved at arbeidstiden fordeles på gjennomsnittlig 5 dagers uke. Ekstra ukefridag skal fortrinnsvis legges i sammenheng med den ukentlige lovbestemte fridag (F1). Det er ingen krav til lengden av slik fridag.',
  F3: 'Arbeidsmiljølovens hovedregel er at alle så vidt mulig skal ha fri på søn- og helgedager. I virksomheter hvor det etter loven er tillatt med søndagsarbeid, skal arbeidstakeren som har utført søn- og helgedagsarbeids ha arbeidsfri følgende søn- og helgedagsdøgn. Slik fritid gis uten trekk i lønn. Det kan gis fritid utover dette. Fritid som gis på helgedager pga. lovens minimumsbestemmelser markeres med F3.',
  F4: 'Kompensasjon for arbeid på helge- og høytidsdager kan i stedet for betaling helt eller delvis avspaseres, se tariffavtalen. Slik(e) fridag(er) markeres ofte med F4.',
  F5: 'Dersom lovbestemt fridag (F1) etter den opprinnelige turnusplanen faller på en helge- eller høytidsdag mellom to søndager, skal det i henhold til tariffavtalen gis en ekstra fridag, eventuelt utbetales ordinær daglønn. Slik fridag markeres som erstatningsfridag med F5.',
  FE: 'Ferie - Feriedag som tas ut i henhold til ferieloven. Ferie overlapper automatisk eksisterende skift når den planlegges.'
} as const

export const DEFAULT_SHIFTS = [
  { name: 'F1', description: DEFAULT_SHIFT_DESCRIPTIONS.F1 },
  { name: 'F2', description: DEFAULT_SHIFT_DESCRIPTIONS.F2 },
  { name: 'F3', description: DEFAULT_SHIFT_DESCRIPTIONS.F3 },
  { name: 'F4', description: DEFAULT_SHIFT_DESCRIPTIONS.F4 },
  { name: 'F5', description: DEFAULT_SHIFT_DESCRIPTIONS.F5 },
  { name: 'FE', description: DEFAULT_SHIFT_DESCRIPTIONS.FE },
] as const

// Shifts that automatically overlay on existing shifts
export const AUTO_OVERLAY_SHIFTS = ['F3', 'F4', 'F5', 'FE'] as const