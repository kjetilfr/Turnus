// src/app/api/ai/populate-turnus/route.ts - IMPROVED JSON PARSING
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

interface ExtractedPlanData {
  custom_shifts: CustomShiftDefinition[]
  rotation_pattern: string[]
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
export const maxDuration = 300 // 5 minutes (max for Vercel Hobby/Pro)

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
      // For non-PDF files, return an error or convert them
      // You could add a PDF conversion step here, or direct users to use PDF
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

    console.log('🤖 Calling Claude API with simplified prompt...')
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
                media_type: 'application/pdf', // Claude only supports PDF
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

**Eksempel 1 frå dokumentet:**
\`\`\`
Uke 50: 08.12.2025 - 14.12.2025 | D1 | D1 | L1 | L1 | | | F1
\`\`\`

Les kolonnane frå venstre mot høgre:
- Kolonne 1 (Måndag 08.12): D1
- Kolonne 2 (Tysdag 09.12): D1
- Kolonne 3 (Onsdag 10.12): L1
- Kolonne 4 (Torsdag 11.12): L1
- Kolonne 5 (Fredag 12.12): TOM (|| betyr tom dag)
- Kolonne 6 (Laurdag 13.12): TOM
- Kolonne 7 (Søndag 14.12): F1

Output: ["D1", "D1", "L1", "L1", null, null, "F1"]

**Eksempel 2 - F1 PÅ TORSDAG (ikkje søndag):**
\`\`\`
Uke 51: 15.12.2025 - 21.12.2025 | K2 | D1 | | F1 | L1 | L1H | L1H
\`\`\`

Tell kolonnane nøye - det er 7 stykk:
- Kolonne 1: K2
- Kolonne 2: D1
- Kolonne 3: TOM (sjå || mellom D1 og F1)
- Kolonne 4: F1
- Kolonne 5: L1
- Kolonne 6: L1H
- Kolonne 7: L1H

Output: ["K2", "D1", null, "F1", "L1", "L1H", "L1H"]

Merk: F1 er på TORSDAG (kolonne 4), ikkje søndag! Dette er rett - ikkje flytt den!

**Eksempel 3:**
\`\`\`
Uke 2: 05.01.2026 - 11.01.2026 | K1 | K1 | N1 | N1 | | | F1
\`\`\`

- Kolonne 1 (Måndag): K1
- Kolonne 2 (Tysdag): K1
- Kolonne 3 (Onsdag): N1
- Kolonne 4 (Torsdag): N1
- Kolonne 5 (Fredag): TOM
- Kolonne 6 (Laurdag): TOM
- Kolonne 7 (Søndag): F1

Output: ["K1", "K1", "N1", "N1", null, null, "F1"]

**Eksempel 4 - Mange tomme dagar:**
\`\`\`
Uke 52: 22.12.2025 - 28.12.2025 | | K1 | | | | | F1
\`\`\`

- Kolonne 1: TOM
- Kolonne 2: K1
- Kolonne 3: TOM
- Kolonne 4: TOM
- Kolonne 5: TOM
- Kolonne 6: TOM
- Kolonne 7: F1

Output: [null, "K1", null, null, null, null, "F1"]

**Eksempel 5 - Ferie (FE):**
\`\`\`
Uke 26: 22.06.2026 - 28.06.2026 | (K1) FE | (K1) FE | FE | (N1) FE | (N1) FE | FE | (F1) FE
\`\`\`

Når du ser "(K1) FE", betyr det:
- Underliggjande vakt er K1
- FE (ferie) ligg oppå
- Du skal BERRE skrive "FE" (ikkje "(K1) FE")

Output: ["FE", "FE", "FE", "FE", "FE", "FE", "FE"]

**KRITISKE REGLAR:**

1. **Tom kolonne = null**: Når du ser ||, betyr det tom dag → bruk null
2. **ALLTID 7 kolonnar**: Kvar veke MÅ ha nøyaktig 7 element
3. **Ikkje hopp over tomme kolonnar**: Dei MÅ teljast og representerast som null
4. **Les tabellen slik den er**: Ikkje flytt vakter, ikkje gjer antagelsar
5. **F1 er IKKJE alltid på søndag**: 
   - F1 er ukefridagen
   - Vanlegvis på søndag (kolonne 7)
   - Men dersom søndag har ei vakt (L1H, L2 osv), står F1 ein annan stad
   - Les kvar kolonne F1 faktisk står i tabellen
6. **Tomme celler er synlege i tabellen**: || (to strekår med ingenting mellom) = tom dag

**Din oppgave:**

1. Hent ut ALLE vaktkode-definisjonar frå "Vaktkode" tabellen (med tider)
2. Les KVAR VEKE-RAD i turnustabellen
3. For kvar veke:
   - Tell kolonnane frå venstre: 1=Mån, 2=Tys, 3=Ons, 4=Tor, 5=Fre, 6=Lau, 7=Søn
   - Skriv ned vaktkoden for kvar kolonne
   - Dersom kolonna er tom, skriv null
   - Du skal ha NØYAKTIG 7 element per veke
4. Set saman alle vekene til ein flat "rotation_pattern" array

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
  "rotation_pattern": ["D1", "D1", "L1", "L1", null, null, "F1", "K2", "D1", null, "F1", ...]
}

**Validering før du returnerer:**
✓ rotation_pattern.length er deleleg med 7
✓ Kvar 7-element blokk representerer Mån-Søn for éin veke
✓ Tomme dagar er null (ikkje hoppa over)
✓ F1 er i den EKSAKTE kolonnen den vises i tabellen
✓ FE har ikkje parentes
✓ Alle custom shifts frå Vaktkode-tabellen er med

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

    // Parse Claude's response with multiple strategies
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    console.log('📄 Raw Claude response length:', responseText.length)

    // Extract JSON from response - try multiple strategies
    let extracted: ExtractedPlanData | null = null
    
    // Strategy 1: Look for JSON between code blocks
    const codeBlockMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      console.log('✅ Found JSON in code block')
      try {
        extracted = JSON.parse(codeBlockMatch[1].trim())
      } catch (e) {
        console.error('❌ Failed to parse code block JSON:', e)
      }
    }
    
    // Strategy 2: Find largest JSON object in response
    if (!extracted) {
      console.log('🔍 Searching for JSON object...')
      const jsonMatches = responseText.match(/\{[\s\S]*?\}/g)
      
      if (jsonMatches && jsonMatches.length > 0) {
        // Try each match, starting with the largest
        const sortedMatches = jsonMatches.sort((a, b) => b.length - a.length)
        
        for (const match of sortedMatches) {
          try {
            const parsed = JSON.parse(match)
            // Validate it has the expected structure
            if (parsed.custom_shifts && parsed.rotation_pattern) {
              console.log('✅ Successfully parsed JSON object')
              extracted = parsed
              break
            }
          } catch (e) {
            // Try next match
            continue
          }
        }
      }
    }

    // Strategy 3: Try to clean and parse the entire response
    if (!extracted) {
      console.log('🧹 Attempting to clean response...')
      try {
        // Remove markdown code blocks
        let cleaned = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        
        // Try to find the first { and last }
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
      console.error('Response preview (first 1000 chars):', responseText.substring(0, 1000))
      console.error('Response preview (last 1000 chars):', responseText.substring(Math.max(0, responseText.length - 1000)))
      throw new Error('Kunne ikkje ekstrahere gyldig JSON frå Claude sitt svar. Prøv igjen eller last opp ein enklare turnus.')
    }

    // Validate extracted data
    if (!extracted.custom_shifts || !extracted.rotation_pattern || extracted.rotation_pattern.length === 0) {
      console.error('❌ Invalid extracted data structure:', {
        has_custom_shifts: !!extracted.custom_shifts,
        has_rotation_pattern: !!extracted.rotation_pattern,
        pattern_length: extracted.rotation_pattern?.length || 0
      })
      throw new Error('Ufullstendig data ekstrahert frå dokumentet')
    }

    // Validate rotation_pattern is divisible by 7
    if (extracted.rotation_pattern.length % 7 !== 0) {
      console.warn(`⚠️ rotation_pattern length not divisible by 7: ${extracted.rotation_pattern.length}`)
      console.warn('This might indicate day-of-week alignment issues')
    }

    const weeks = Math.floor(extracted.rotation_pattern.length / 7)
    console.log('✅ Extracted data:', {
      custom_shifts: extracted.custom_shifts.length,
      rotation_pattern_length: extracted.rotation_pattern.length,
      weeks: weeks,
      expected_weeks: plan.duration_weeks
    })

    // Log first week as example
    if (extracted.rotation_pattern.length >= 7) {
      const firstWeek = extracted.rotation_pattern.slice(0, 7)
      console.log('📅 Week 1 (Mon-Sun):', firstWeek)
      console.log('   Expected: D1, D1, L1, L1, empty, empty, F1')
    }

    // Log second week to check alignment
    if (extracted.rotation_pattern.length >= 14) {
      const secondWeek = extracted.rotation_pattern.slice(7, 14)
      console.log('📅 Week 2 (Mon-Sun):', secondWeek)
      console.log('   Expected: K1, K1, N1, N1, empty, empty, F1')
      
      // Check if F1 is in correct position (should be position 6 = Sunday)
      if (secondWeek[6] !== 'F1' && secondWeek.includes('F1')) {
        const f1Position = secondWeek.indexOf('F1')
        console.warn(`⚠️ Week 2: F1 found at position ${f1Position} instead of 6 (Sunday)`)
        console.warn('   This indicates day-of-week misalignment!')
      }
    }

    // Log a week with F1 NOT on Sunday (week 51)
    if (extracted.rotation_pattern.length >= 14) {
      const week51Index = 50 * 7 // Week 51 is index 350-356
      if (extracted.rotation_pattern.length > week51Index + 7) {
        const week51 = extracted.rotation_pattern.slice(week51Index, week51Index + 7)
        console.log('📅 Week 51 (example of F1 NOT on Sunday):', week51)
        console.log('   Expected: K2, D1, empty, F1, L1, L1H, L1H')
        console.log('   Note: F1 is on Thursday (position 3) because weekend has shifts')
      }
    }

    // Log any FE shifts found
    const feCount = extracted.rotation_pattern.filter(s => s === 'FE').length
    if (feCount > 0) {
      console.log(`🏖️ Found ${feCount} vacation (FE) days`)
    }

    // Check for F3 shifts
    const f3Count = extracted.rotation_pattern.filter(s => s === 'F3').length
    if (f3Count > 0) {
      console.log(`💰 Found ${f3Count} F3 compensation days`)
    }

    // Track AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: 'turnus_populate',
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
    })

    // Create custom shifts
    const customShiftMap = new Map<string, string>()
    
    if (extracted.custom_shifts && extracted.custom_shifts.length > 0) {
      for (const customShift of extracted.custom_shifts) {
        // Skip standard F-shifts as they're created automatically
        if (['F', 'F1', 'F2', 'F3', 'F4', 'F5'].includes(customShift.name)) {
          continue
        }

        // Check if shift already exists
        const { data: existingShift } = await supabase
          .from('shifts')
          .select('id')
          .eq('plan_id', planId)
          .eq('name', customShift.name)
          .maybeSingle()

        if (existingShift) {
          // Update existing shift
          const { data: updatedShift } = await supabase
            .from('shifts')
            .update({
              description: customShift.description,
              start_time: customShift.start_time,
              end_time: customShift.end_time,
            })
            .eq('id', existingShift.id)
            .select()
            .single()

          if (updatedShift) {
            customShiftMap.set(customShift.name, updatedShift.id)
          }
        } else {
          // Create new shift
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
            customShiftMap.set(customShift.name, createdShift.id)
          }
        }
      }
    }

    // Get all shifts for this plan (including default F-shifts)
    const { data: allShifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('plan_id', planId)

    const shiftNameToIdMap = new Map<string, string>()
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
      const patternLength = extracted.rotation_pattern.length
      
      for (let i = 0; i < patternLength; i++) {
        const weekIndex = Math.floor(i / 7)
        const dayOfWeek = i % 7
        const shiftName = extracted.rotation_pattern[i]
        
        // Skip null or empty entries
        if (!shiftName || shiftName === 'null' || shiftName === '') {
          continue
        }
        
        const shiftId = shiftNameToIdMap.get(shiftName)

        if (shiftId) {
          rotations.push({
            plan_id: planId,
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
          throw rotationError
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        custom_shifts_count: extracted.custom_shifts?.length || 0,
        rotation_entries_count: extracted.rotation_pattern?.length || 0,
      }
    })

  } catch (error) {
    console.error('💥 File processing error:', error)
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
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