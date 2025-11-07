// src/app/api/ai/upload-turnus/route.ts - MULTI-FORMAT TURNUS UPLOAD
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Define types for extracted data
interface ExtractedShift {
  date: string
  shift_type: string
  start_time: string
  end_time: string
  hours: number
}

interface CustomShiftDefinition {
  name: string
  start_time: string
  end_time: string
  hours: number
  description?: string
}

interface ExtractedPlanData {
  plan_name: string
  employee_name?: string
  start_date: string
  end_date?: string
  rotation_pattern?: string[]
  custom_shifts: CustomShiftDefinition[]
  shifts: ExtractedShift[]
  work_percent?: number
  duration_weeks?: number
}

// Supported file types
const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/rtf',
  'text/rtf'
]

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.rtf']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has Premium tier access
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  if (!subscription || subscription.tier !== 'premium' || subscription.status !== 'active') {
    return NextResponse.json(
      { error: 'Premium tier subscription required' },
      { status: 403 }
    )
  }

  // Get the uploaded file
  const formData = await request.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  // Validate file type
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  const isValidType = SUPPORTED_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(fileExtension)
  
  if (!isValidType) {
    return NextResponse.json({ 
      error: 'Feil filtype. Støtta format: PDF, DOCX, RTF',
      supported: 'PDF, DOCX, DOC, RTF'
    }, { status: 400 })
  }

  // Check file size (limit to 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fila er for stor (maks 10MB)' }, { status: 400 })
  }

  try {
    // Convert file to base64 for Claude
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Determine media type - Claude supports PDF, DOCX, and other document formats
    let mediaType: string = 'application/pdf'
    
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileExtension === '.docx') {
      mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    } else if (file.type === 'application/msword' || fileExtension === '.doc') {
      mediaType = 'application/msword'
    } else if (file.type === 'application/rtf' || file.type === 'text/rtf' || fileExtension === '.rtf') {
      mediaType = 'application/rtf'
    }

    // Send to Claude for extraction
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType as any, // Type cast - Claude supports multiple document types
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analyser denne norske turnusplanen og ekstraher ALL informasjon om vakter og vaktkoder.

**VIKTIG**: Denne planen brukar truleg spesifikke vaktkoder som D1, K1, L1, N1, osv. Du må:
1. Identifisere ALLE unike vaktkoder i planen
2. For kvar vaktkode, finn starttid, sluttid og varigheit (i timar)
3. Vaktkoden (D1, K1, osv.) SKAL vere "name" feltet
4. Beskrivelsen (Dagvakt, Seinvakt, osv.) SKAL vere "description" feltet
5. Lag både rotasjonsmønsteret OG alle individuelle vakter

**Returner som JSON i dette formatet:**

{
  "plan_name": "Namn på turnusplanen (t.d. 'Turnus 2025-2026' eller medarbeidar namn)",
  "employee_name": "Namn på medarbeidar (om tilgjengeleg)",
  "start_date": "YYYY-MM-DD (første vakt sin dato)",
  "end_date": "YYYY-MM-DD (siste vakt sin dato)",
  "duration_weeks": 52,
  "work_percent": 100,
  "custom_shifts": [
    {
      "name": "D1",
      "start_time": "07:45",
      "end_time": "15:15",
      "hours": 7.5,
      "description": "Dagvakt"
    },
    {
      "name": "K1",
      "start_time": "15:00",
      "end_time": "22:30",
      "hours": 7.5,
      "description": "Seinvakt"
    }
  ],
  "rotation_pattern": ["D1", "D1", "D1", "K1", "K1", "N1", "N1", "F1", "F1", "F1"],
  "shifts": [
    {
      "date": "2025-12-08",
      "shift_type": "D1",
      "start_time": "07:45",
      "end_time": "15:15",
      "hours": 7.5
    },
    {
      "date": "2025-12-09",
      "shift_type": "D1",
      "start_time": "07:45",
      "end_time": "15:15",
      "hours": 7.5
    }
  ]
}

**Retningslinjer for norske turnusar:**

**Standard vaktkoder (bruk desse om dei ikkje er definert i planen):**
- D/D1 = Dagvakt (07:00-15:00 eller 07:30-15:30, ca 7.5t)
- A/A1 = Aftenvakt (15:00-23:00, ca 8t)
- N/N1 = Nattevakt (23:00-07:00 eller 22:00-06:00, ca 8t)
- F/F1 = Fridag (00:00-00:00, 0t)
- F3 = Helgedagsfridag/kompensasjonsdag (00:00-00:00, 0t)
- F5 = Erstatningsfridag (00:00-00:00, 0t)

**Vaktkoder i dokumentet (SJEKK TABELLEN):**
- Dokumentet har truleg ein tabell med "Vaktkode", "Beskrivelse", "Varighet"
- Ekstraher ALLE vaktkoder frå denne tabellen med eksakte tider
- Eksempel vaktkoder: D1, K1, K2, KM1, L1, L1H, L2, L3, L4, N1, N2, MØT

**Ukestruktur:**
- Ukenummer og datoar er formatert som "Uke 50: 08.12.2025 - 14.12.2025"
- Kolonner: Man|Tir|Ons|Tor|Fre|Lør|Søn|Timer
- Tom celle = ingen vakt/arbeider ikkje
- F1 = ukefridag (plasser på vekedag)

**Spesialkodar:**
- FE i parentes som "(K1) FE" = Ferie, men original vakt er K1
- Fleire koder same dag = overlappande vakter eller endring

**KRITISK:**
1. Ekstraher ALLE vaktkoder frå vakttabellen i dokumentet
2. For kvar unik vaktkode, finn starttid, sluttid og varigheit
3. Lag custom_shifts array med ALLE desse vaktkodene
4. Bruk eksakte tider frå tabellen, IKKJE standard tider
5. Inkluder beskrivelsen frå tabellen i "description" felt
6. For F3/F5/F1 fridag-typar, sett start_time og end_time til "00:00" og hours til 0

**Output:**
- Returner BERRE gyldig JSON
- Ingen forklarande tekst
- Sørg for at alle datoar er sekvenssielle og dekker full periode
- Inkluder rotation_pattern berre om du kan identifisere eit tydeleg mønster`,
            },
          ],
        },
      ],
    })

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    // Extract JSON from response (Claude might include explanation text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Kunne ikkje ekstrahere JSON frå Claude sitt svar')
    }

    const extracted = JSON.parse(jsonMatch[0]) as ExtractedPlanData

    // Validate extracted data
    if (!extracted.plan_name || !extracted.start_date || !extracted.shifts || extracted.shifts.length === 0) {
      throw new Error('Ufullstendig data ekstrahert frå dokumentet')
    }

    // Track AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: 'turnus_upload',
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
    })

    // Create the plan in database
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        user_id: user.id,
        name: extracted.plan_name,
        start_date: extracted.start_date,
        end_date: extracted.end_date || extracted.shifts[extracted.shifts.length - 1].date,
        duration_weeks: extracted.duration_weeks || Math.ceil(extracted.shifts.length / 7),
        work_percent: extracted.work_percent || 100,
        type: 'main',
      })
      .select()
      .single()

    if (planError) {
      console.error('Plan creation error:', planError)
      throw planError
    }

    // Create custom shifts first
    const customShiftMap = new Map<string, string>()
    
    if (extracted.custom_shifts && extracted.custom_shifts.length > 0) {
      for (const customShift of extracted.custom_shifts) {
        // Skip standard F-shifts as they're created automatically
        if (['F', 'F1', 'F2', 'F3', 'F4', 'F5'].includes(customShift.name)) {
          continue
        }

        const { data: createdShift, error: shiftError } = await supabase
          .from('shifts')
          .insert({
            plan_id: plan.id,
            name: customShift.name, // e.g., "D1", "K1", "L1"
            description: customShift.description, // e.g., "Dagvakt", "Seinvakt"
            start_time: customShift.start_time,
            end_time: customShift.end_time,
            is_default: false,
          })
          .select()
          .single()

        if (shiftError) {
          console.error('Error creating custom shift:', shiftError)
          continue
        }

        if (createdShift) {
          customShiftMap.set(customShift.name, createdShift.id)
        }
      }
    }

    // Get all shifts (including default F-shifts)
    const { data: allShifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('plan_id', plan.id)

    const shiftNameToIdMap = new Map<string, string>()
    allShifts?.forEach(shift => {
      shiftNameToIdMap.set(shift.name, shift.id)
    })

    // Create rotation if pattern exists
    if (extracted.rotation_pattern && extracted.rotation_pattern.length > 0) {
      const rotations = []
      const patternLength = extracted.rotation_pattern.length
      const weeksInRotation = Math.ceil(patternLength / 7)
      
      for (let i = 0; i < patternLength; i++) {
        const weekIndex = Math.floor(i / 7)
        const dayOfWeek = i % 7
        const shiftName = extracted.rotation_pattern[i]
        const shiftId = shiftNameToIdMap.get(shiftName)

        if (shiftId) {
          rotations.push({
            plan_id: plan.id,
            week_index: weekIndex,
            day_of_week: dayOfWeek,
            shift_id: shiftId,
          })
        }
      }

      if (rotations.length > 0) {
        const { error: rotationError } = await supabase
          .from('rotations')
          .insert(rotations)

        if (rotationError) {
          console.error('Error creating rotations:', rotationError)
        }
      }
    }

    // Store AI generation record
    await supabase.from('ai_generated_plans').insert({
      user_id: user.id,
      plan_id: plan.id,
      extraction_data: extracted,
    })

    return NextResponse.json({
      success: true,
      planId: plan.id,
      data: {
        plan_name: extracted.plan_name,
        employee_name: extracted.employee_name,
        start_date: extracted.start_date,
        end_date: extracted.end_date,
        shift_count: extracted.shifts.length,
        custom_shifts_count: extracted.custom_shifts?.length || 0,
        rotation_pattern: extracted.rotation_pattern,
        duration_weeks: extracted.duration_weeks,
      }
    })

  } catch (error) {
    console.error('File processing error:', error)
    return NextResponse.json(
      { 
        error: 'Kunne ikkje prosessere fila', 
        details: error instanceof Error ? error.message : 'Ukjend feil' 
      },
      { status: 500 }
    )
  }
}