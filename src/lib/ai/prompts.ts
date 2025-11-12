// src/lib/ai/prompts.ts
// Centralized AI prompts for turnus population

export const TURNUS_POPULATION_PROMPT = `Du analyserer eit norsk turnusdokument frå helsesektoren.

**KRITISK: Korleis lese tabellen**

Kvar rad i dokumentet representerer ÉIN VEKE med NØYAKTIG 7 kolonnar:

Kolonne 1 = Måndag (Man)
Kolonne 2 = Tysdag (Tir)
Kolonne 3 = Onsdag (Ons)
Kolonne 4 = Torsdag (Tor)
Kolonne 5 = Fredag (Fre)
Kolonne 6 = Laurdag (Lør)
Kolonne 7 = Søndag (Søn)

**KRITISK: Overlay-handling (FE/F3/F4/F5)**

rotation_pattern skal vere ein array av objekt med 3 felt:

{
  "shift": "VAKTNAMN" eller null,
  "overlay": "OVERLAY" eller null,
  "day": 0-6
}

**SVÆRT VIKTIG: Standard vs Custom Shifts**

Det er KUN 6 standard shifts som allereie eksisterer i systemet:
- F1, F2, F3, F4, F5, FE

ALLE ANDRE vaktkoder (som D1, K1, L1, N1, A1, osv.) er CUSTOM SHIFTS som du MÅ lage!

**REGEL 1: Når du ser ein vaktkode i dokumentet:**

1. Er det F1, F2, F3, F4, F5 eller FE?
   → IKKJE lag den i custom_shifts (den eksisterer allereie)
   
2. Er det noko anna (D1, K1, L1, N1, osv.)?
   → MÅ lage den i custom_shifts med tider frå "Vaktkode"-tabellen

**REGEL 2: Overlay-tolking:**

1. **Vaktkode ALEINE (utan parentes):**
   - "FE" → {"shift": "FE", "overlay": null, "day": 0}
   - "F3" → {"shift": "F3", "overlay": null, "day": 0}
   - "D1" → {"shift": "D1", "overlay": null, "day": 0}
   - "K1" → {"shift": "K1", "overlay": null, "day": 0}

2. **Vaktkode MED OVERLAY (i parentes):**
   - "(K1) FE" → {"shift": "K1", "overlay": "FE", "day": 0}
     * LAG K1 i custom_shifts
     * IKKJE lag FE i custom_shifts (er standard)
   
   - "(D1) F3" → {"shift": "D1", "overlay": "F3", "day": 0}
     * LAG D1 i custom_shifts
     * IKKJE lag F3 i custom_shifts (er standard)
   
   - "(F1) FE" → {"shift": "F1", "overlay": "FE", "day": 0}
     * IKKJE lag F1 i custom_shifts (er standard)
     * IKKJE lag FE i custom_shifts (er standard)

3. **Tom kolonne:**
   - "" → {"shift": null, "overlay": null, "day": 0}

**EKSEMPEL - Fullstendig tolking:**

**Veke 26:** | (K1) FE | (K1) FE | FE | D1 | (N1) FE | FE | F1

**Steg 1 - Identifiser ALLE vaktkoder:**
- K1: Ikkje standard → LAG i custom_shifts
- FE: Standard → IKKJE lag i custom_shifts
- D1: Ikkje standard → LAG i custom_shifts
- N1: Ikkje standard → LAG i custom_shifts
- F1: Standard → IKKJE lag i custom_shifts

**Steg 2 - Lag custom_shifts:**
\`\`\`json
{
  "custom_shifts": [
    {"name": "K1", "start_time": "07:00", "end_time": "15:00", "hours": 7.5, "description": "Kveldsvakt"},
    {"name": "D1", "start_time": "07:30", "end_time": "15:30", "hours": 8, "description": "Dagvakt"},
    {"name": "N1", "start_time": "23:00", "end_time": "07:00", "hours": 8, "description": "Nattvakt"}
  ]
}
\`\`\`

**Steg 3 - Lag rotation_pattern:**
\`\`\`json
{
  "rotation_pattern": [
    {"shift": "K1", "overlay": "FE", "day": 0},  // Måndag
    {"shift": "K1", "overlay": "FE", "day": 1},  // Tysdag
    {"shift": "FE", "overlay": null, "day": 2},  // Onsdag
    {"shift": "D1", "overlay": null, "day": 3},  // Torsdag
    {"shift": "N1", "overlay": "FE", "day": 4},  // Fredag
    {"shift": "FE", "overlay": null, "day": 5},  // Laurdag
    {"shift": "F1", "overlay": null, "day": 6}   // Søndag
  ]
}
\`\`\`

**KOMPLETT EKSEMPEL-OUTPUT:**

\`\`\`json
{
  "custom_shifts": [
    {"name": "D1", "start_time": "07:45", "end_time": "15:15", "hours": 7.5, "description": "07:45 - 15:15 (7,50t)"},
    {"name": "K1", "start_time": "15:00", "end_time": "23:00", "hours": 8, "description": "15:00 - 23:00 (8,00t)"},
    {"name": "L1", "start_time": "06:30", "end_time": "18:00", "hours": 11.5, "description": "06:30 - 18:00 (11,50t)"},
    {"name": "N1", "start_time": "23:00", "end_time": "07:00", "hours": 8, "description": "23:00 - 07:00 (8,00t)"}
  ],
  "rotation_pattern": [
    {"shift": "D1", "overlay": null, "day": 0},
    {"shift": "D1", "overlay": null, "day": 1},
    {"shift": "K1", "overlay": null, "day": 2},
    {"shift": "K1", "overlay": null, "day": 3},
    {"shift": null, "overlay": null, "day": 4},
    {"shift": null, "overlay": null, "day": 5},
    {"shift": "F1", "overlay": null, "day": 6}
  ]
}
\`\`\`

**VIKTIG REGLAR:**

1. **Alltid 7 objekt per veke** (ein per dag, Måndag-Søndag)
2. **day går frå 0-6** for kvar veke, start på 0 igjen for neste veke
3. **Parentes betyr overlay**: "(K1) FE" = K1-vakt med FE oppå
4. **Ingen parentes = berre shift**: "FE" = berre ferie, "D1" = berre dagvakt
5. **Tom kolonne** = {"shift": null, "overlay": null, "day": X}
6. **Berre F1, F2, F3, F4, F5, FE er standard** - ALDRI lag dei i custom_shifts!
7. **Alt anna MÅ vere i custom_shifts** - D1, K1, L1, N1, A1, osv.
8. **F1 skift er maks 1 per veke. Ligger som regel på søndag, med mindre det er vakt den dagen.
9. **Nokre raude felt i dokumentet, ignorer det og behandle dei som vanleg.

**Din oppgave:**

1. Finn "Vaktkode" tabellen i dokumentet
2. For KVAR vaktkode som IKKJE er F1/F2/F3/F4/F5/FE:
   - Hent vaktkode-namn, start_time, end_time, hours, description
   - Legg til i custom_shifts arrayen
3. Les turnustabellen rad for rad (kvar rad = 1 veke)
4. For kvar dag:
   - Identifiser vaktkode og evt. overlay
   - Lag rotation_pattern entry med riktig day (0-6)

**Returner BERRE denne JSON-strukturen:**

{
  "custom_shifts": [
    {
      "name": "D1",
      "start_time": "07:45",
      "end_time": "15:15",
      "hours": 7.5,
      "description": "07:45 - 15:15 (7,50t)"
    }
  ],
  "rotation_pattern": [
    {"shift": "D1", "overlay": null, "day": 0},
    {"shift": "D1", "overlay": null, "day": 1},
    ...
  ]
}

**SJEKKLISTE FØR DU RETURNERER:**
✓ custom_shifts har IKKJE F1, F2, F3, F4, F5, eller FE
✓ custom_shifts har ALLE andre vaktkoder (D1, K1, L1, N1, osv.)
✓ rotation_pattern har objekt med shift, overlay, og day
✓ Nøyaktig 7 objekt per veke
✓ day er 0-6, start på 0 for kvar nye veke
✓ overlay er null når det IKKJE er parentes
✓ overlay har verdi når det ER parentes: (VAKT) OVERLAY

**VIKTIG: Returner BERRE gyldig JSON. Ingen markdown, ingen forklaringar, ingen kodeblokkar.**`

export const getClaudePrompt = () => TURNUS_POPULATION_PROMPT

export const getGPT4oPrompt = () => TURNUS_POPULATION_PROMPT

export const getGeminiPrompt = () => TURNUS_POPULATION_PROMPT