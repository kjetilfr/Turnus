// src/app/api/ai/populate-turnus/route.ts - WITH OVERLAY SUPPORT
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Define types for extracted data
interface CustomShiftDefinition {
  name: string
  start_time: string
  end_time: string
  hours: number
  description?: string
}

interface RotationEntry {
  shift: string | null
  overlay: string | null
  day: number  // 0-6 (Monday-Sunday)
}

interface ExtractedPlanData {
  custom_shifts: CustomShiftDefinition[]
  rotation_pattern: RotationEntry[]
}

// Supported file types
const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/rtf',
  'text/rtf'
]

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.rtf']

// Increase route timeout for PDF processing
export const maxDuration = 300 // 5 minutes

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has Premium tier access
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  console.log('🔐 Subscription check:', { 
    userId: user.id, 
    subscription, 
    subError,
    hasPremium: subscription?.tier === 'premium' && subscription?.status === 'active'
  })

  if (!subscription || subscription.tier !== 'premium' || subscription.status !== 'active') {
    console.log('❌ Premium access denied:', { 
      tier: subscription?.tier, 
      status: subscription?.status 
    })
    return NextResponse.json(
      { error: 'Premium tier subscription required' },
      { status: 403 }
    )
  }

  // Get the uploaded file and planId
  const formData = await request.formData()
  const file = formData.get('file') as File
  const planId = formData.get('planId') as string
  
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  if (!planId) {
    return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })
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
    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not configured')
      return NextResponse.json(
        { 
          error: 'AI funksjon ikkje konfigurert',
          details: 'ANTHROPIC_API_KEY mangler i miljøvariablar.'
        },
        { status: 500 }
      )
    }

    // Verify plan exists and belongs to user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Convert file to base64 for Claude
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Determine media type
    const isPDF = file.type === 'application/pdf' || fileExtension === '.pdf'

    if (!isPDF) {
      return NextResponse.json(
        { 
          error: 'For Claude AI, berre PDF er støtta. Prøv å konvertere dokumentet til PDF eller bruk ein annan AI-modell (GPT-4o eller Gemini).',
          suggestion: 'Du kan bruke "Auto" modell som automatisk vel beste modell for filtypen din.'
        },
        { status: 400 }
      )
    }

    // Send to Claude for extraction
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 180000,
      maxRetries: 2,
    })

    console.log('🤖 Calling Claude API...')
    console.log('📄 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB')

    const startTime = Date.now()

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Du analyserer eit norsk turnusdokument frå helsesektoren.

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

**Tolking av dokumentet:**

"(K1) FE" → {"shift": "K1", "overlay": "FE", "day": 0}
"FE" (utan parentes) → {"shift": "FE", "overlay": null, "day": 0}
"D1" → {"shift": "D1", "overlay": null, "day": 0}
"" (tom) → {"shift": null, "overlay": null, "day": 0}

**Eksempel 1 - Uke 26 (ferie med overlays):**
\`\`\`
Uke 26: 22.06.2026 - 28.06.2026 | (K1) FE | (K1) FE | FE | (N1) FE | (N1) FE | FE | (F1) FE
\`\`\`

Dag-for-dag analyse:
- Måndag (day 0): "(K1) FE" → {"shift": "K1", "overlay": "FE", "day": 0}
- Tysdag (day 1): "(K1) FE" → {"shift": "K1", "overlay": "FE", "day": 1}
- Onsdag (day 2): "FE" → {"shift": "FE", "overlay": null, "day": 2}
- Torsdag (day 3): [tom] → {"shift": null, "overlay": null, "day": 3}
- Fredag (day 4): "(N1) FE" → {"shift": "N1", "overlay": "FE", "day": 4}
- Laurdag (day 5): "FE" → {"shift": "FE", "overlay": null, "day": 5}
- Søndag (day 6): "(F1) FE" → {"shift": "F1", "overlay": "FE", "day": 6}

Output for uke 26 (7 objekt, ein per dag):
[
  {"shift": "K1", "overlay": "FE", "day": 0},
  {"shift": "K1", "overlay": "FE", "day": 1},
  {"shift": "FE", "overlay": null, "day": 2},
  {"shift": null, "overlay": null, "day": 3},
  {"shift": "N1", "overlay": "FE", "day": 4},
  {"shift": "FE", "overlay": null, "day": 5},
  {"shift": "F1", "overlay": "FE", "day": 6}
]

**Eksempel 2 - Uke 50 (vanleg veke utan overlays):**
\`\`\`
Uke 50: 08.12.2025 - 14.12.2025 | D1 | D1 | L1 | L1 | | | F1
\`\`\`

Output (7 objekt):
[
  {"shift": "D1", "overlay": null, "day": 0},
  {"shift": "D1", "overlay": null, "day": 1},
  {"shift": "L1", "overlay": null, "day": 2},
  {"shift": "L1", "overlay": null, "day": 3},
  {"shift": null, "overlay": null, "day": 4},
  {"shift": null, "overlay": null, "day": 5},
  {"shift": "F1", "overlay": null, "day": 6}
]

**Eksempel 3 - F3 compensation:**
\`\`\`
Uke 14: | K1 | K1 | F3 | F3 | | | F1
\`\`\`

Onsdag (day 2): "F3" (ingen parentes) → {"shift": "F3", "overlay": null, "day": 2}
Torsdag (day 3): "F3" (ingen parentes) → {"shift": "F3", "overlay": null, "day": 3}

Men hvis det var "(D1) F3" → {"shift": "D1", "overlay": "F3", "day": 2}

**VIKTIG REGLAR:**

1. **Alltid 7 objekt per veke** (ein per dag, Måndag-Søndag)
2. **day går frå 0-6** for kvar veke, start på 0 igjen for neste veke
3. **Parentes betyr overlay**: "(K1) FE" = K1-vakt med FE oppå
4. **Ingen parentes = berre shift**: "FE" = berre ferie, "D1" = berre dagvakt
5. **Tom kolonne** = {"shift": null, "overlay": null, "day": X}

**Din oppgave:**

1. Hent ut ALLE vaktkode-definisjonar frå "Vaktkode" tabellen (med tider)
2. Les KVAR VEKE-RAD i turnustabellen
3. For kvar veke:
   - Tell kolonnane frå venstre: 1=Mån, 2=Tys, 3=Ons, 4=Tor, 5=Fre, 6=Lau, 7=Søn
   - Output nøyaktig 7 objekt (ein per dag)
   - Bruk day 0-6 for dagane (0=Måndag, 6=Søndag)
4. For neste veke, start på day 0 igjen

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

**Validering før du returnerer:**
✓ rotation_pattern har objekt med shift, overlay, og day
✓ Nøyaktig 7 objekt per veke
✓ day er 0-6, start på 0 for kvar nye veke
✓ overlay er null når det IKKJE er parentes
✓ overlay har verdi når det ER parentes: (VAKT) OVERLAY

**VIKTIG: Returner BERRE gyldig JSON. Ingen markdown, ingen forklaringar, ingen kodeblokkar.**`,
            },
          ],
        },
      ],
    })

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ Claude API responded in ${elapsedTime}s`)
    console.log('📊 Token usage:', {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      total: message.usage.input_tokens + message.usage.output_tokens
    })

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    console.log('📄 Raw Claude response length:', responseText.length)

    // Extract JSON from response
    let extracted: ExtractedPlanData | null = null
    
    // Try multiple extraction strategies
    const codeBlockMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      console.log('✅ Found JSON in code block')
      try {
        extracted = JSON.parse(codeBlockMatch[1].trim())
      } catch (e) {
        console.error('❌ Failed to parse code block JSON:', e)
      }
    }
    
    if (!extracted) {
      const jsonMatches = responseText.match(/\{[\s\S]*?\}/g)
      
      if (jsonMatches && jsonMatches.length > 0) {
        const sortedMatches = jsonMatches.sort((a, b) => b.length - a.length)
        
        for (const match of sortedMatches) {
          try {
            const parsed = JSON.parse(match)
            if (parsed.custom_shifts && parsed.rotation_pattern) {
              console.log('✅ Successfully parsed JSON object')
              extracted = parsed
              break
            }
          } catch (e) {
            continue
          }
        }
      }
    }

    if (!extracted) {
      console.log('🧹 Attempting to clean response...')
      try {
        let cleaned = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        
        const firstBrace = cleaned.indexOf('{')
        const lastBrace = cleaned.lastIndexOf('}')
        
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1)
          extracted = JSON.parse(cleaned)
          console.log('✅ Successfully parsed cleaned response')
        }
      } catch (e) {
        console.error('❌ Failed to parse cleaned response:', e)
      }
    }

    if (!extracted) {
      console.error('❌ All JSON extraction strategies failed')
      throw new Error('Kunne ikkje ekstrahere gyldig JSON frå Claude sitt svar.')
    }

    // Validate extracted data
    if (!extracted.custom_shifts || !extracted.rotation_pattern || extracted.rotation_pattern.length === 0) {
      console.error('❌ Invalid extracted data structure')
      throw new Error('Ufullstendig data ekstrahert frå dokumentet')
    }

    const weeks = Math.floor(extracted.rotation_pattern.length / 7)
    console.log('✅ Extracted data:', {
      custom_shifts: extracted.custom_shifts.length,
      rotation_pattern_length: extracted.rotation_pattern.length,
      weeks: weeks
    })

    // Track AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: 'turnus_populate',
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
    })

    // Create custom shifts
    const shiftNameToIdMap = new Map<string, string>()
    
    if (extracted.custom_shifts && extracted.custom_shifts.length > 0) {
      for (const customShift of extracted.custom_shifts) {
        // Skip standard F-shifts as they're created automatically
        if (['F', 'F1', 'F2', 'F3', 'F4', 'F5'].includes(customShift.name)) {
          continue
        }

        const { data: existingShift } = await supabase
          .from('shifts')
          .select('id')
          .eq('plan_id', planId)
          .eq('name', customShift.name)
          .maybeSingle()

        if (existingShift) {
          await supabase
            .from('shifts')
            .update({
              description: customShift.description,
              start_time: customShift.start_time,
              end_time: customShift.end_time,
            })
            .eq('id', existingShift.id)
          
          shiftNameToIdMap.set(customShift.name, existingShift.id)
        } else {
          const { data: createdShift, error: shiftError } = await supabase
            .from('shifts')
            .insert({
              plan_id: planId,
              name: customShift.name,
              description: customShift.description,
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
            shiftNameToIdMap.set(customShift.name, createdShift.id)
          }
        }
      }
    }

    // Get all shifts for this plan (including default F-shifts)
    const { data: allShifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('plan_id', planId)

    allShifts?.forEach(shift => {
      shiftNameToIdMap.set(shift.name, shift.id)
    })

    // Delete existing rotations for this plan
    await supabase
      .from('rotations')
      .delete()
      .eq('plan_id', planId)

    // Create new rotation from pattern
    if (extracted.rotation_pattern && extracted.rotation_pattern.length > 0) {
      const rotations = []
      let currentWeek = 0
      
      for (let i = 0; i < extracted.rotation_pattern.length; i++) {
        const entry = extracted.rotation_pattern[i]
        
        // Detect week boundaries (when day wraps from 6 to 0)
        if (i > 0) {
          const prevEntry = extracted.rotation_pattern[i - 1]
          if (prevEntry.day === 6 && entry.day === 0) {
            currentWeek++
          }
        }
        
        // Get shift IDs
        const shiftId = entry.shift ? shiftNameToIdMap.get(entry.shift) : null
        const overlayShiftId = entry.overlay ? shiftNameToIdMap.get(entry.overlay) : null
        
        // Skip if completely empty day (no shift and no overlay)
        if (!shiftId && !overlayShiftId) {
          continue
        }
        
        rotations.push({
          plan_id: planId,
          week_index: currentWeek,
          day_of_week: entry.day,
          shift_id: shiftId,
          overlay_shift_id: overlayShiftId,
          overlay_type: entry.overlay || null,
        })
      }

      console.log(`📅 Created ${rotations.length} rotation entries across ${currentWeek + 1} weeks`)

      if (rotations.length > 0) {
        const { error: rotationError } = await supabase
          .from('rotations')
          .insert(rotations)

        if (rotationError) {
          console.error('Error creating rotations:', rotationError)
          throw rotationError
        }
      }
    }

    return NextResponse.json({
      success: true,
      ai_model: 'claude-sonnet-4',
      data: {
        custom_shifts_count: extracted.custom_shifts?.length || 0,
        rotation_entries_count: extracted.rotation_pattern?.length || 0,
      }
    })

  } catch (error) {
    console.error('💥 File processing error:', error)
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    
    return NextResponse.json(
      { 
        error: 'Kunne ikkje prosessere fila', 
        details: error instanceof Error ? error.message : 'Ukjend feil',
        errorType: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    )
  }
}