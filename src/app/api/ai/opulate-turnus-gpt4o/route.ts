// src/app/api/ai/populate-turnus-gpt4o/route.ts - GPT-4o version
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

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
  rotation_pattern: (string | null)[]
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

// Increase route timeout
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check Premium access
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

  const formData = await request.formData()
  const file = formData.get('file') as File
  const planId = formData.get('planId') as string
  
  if (!file || !planId) {
    return NextResponse.json({ error: 'File and planId required' }, { status: 400 })
  }

  // Validate file
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  const isValidType = SUPPORTED_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(fileExtension)
  
  if (!isValidType) {
    return NextResponse.json({ 
      error: 'Feil filtype. Støtta format: PDF, DOCX, RTF'
    }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fila er for stor (maks 10MB)' }, { status: 400 })
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key ikkje konfigurert' },
        { status: 500 }
      )
    }

    // Verify plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    console.log('🤖 Calling GPT-4o API...')
    console.log('📄 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB')

    const startTime = Date.now()

    // Create message with base64 PDF
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Du analyserer eit norsk turnusdokument frå helsesektoren.

**STEG-FOR-STEG: Korleis lese kvar rad**

Kvar veke-rad har NØYAKTIG 7 kolonnar separert med | (strekår):
Man | Tir | Ons | Tor | Fre | Lør | Søn

**Eksempel 1:**
Uke 50: 08.12.2025 - 14.12.2025 | D1 | D1 | L1 | L1 | | | F1

Tell NØYE frå venstre:
1. Man = D1
2. Tir = D1  
3. Ons = L1
4. Tor = L1
5. Fre = TOM (ingen tekst mellom ||)
6. Lør = TOM
7. Søn = F1

Output: ["D1", "D1", "L1", "L1", null, null, "F1"]

**Eksempel 2 (F1 på torsdag!):**
Uke 51: 15.12.2025 - 21.12.2025 | K2 | D1 | | F1 | L1 | L1H | L1H

Tell NØYE:
1. Man = K2
2. Tir = D1
3. Ons = TOM (sjå || mellom D1 og F1)
4. Tor = F1
5. Fre = L1
6. Lør = L1H
7. Søn = L1H

Output: ["K2", "D1", null, "F1", "L1", "L1H", "L1H"]

**KRITISKE REGLAR:**
1. Alltid NØYAKTIG 7 element per veke
2. Tom kolonne (||) = null
3. Les frå venstre til høgre, tell ALLE kolonnar
4. F1 kan vere på kva som helst dag (ikkje berre søndag!)
5. FE: Skriv berre "FE" (fjern parentesar)

**Din oppgave:**
1. Hent alle vaktkode-definisjonar frå "Vaktkode" tabellen
2. Les KVAR veke-rad
3. Tell kolonnane 1-7 frå venstre
4. Output: NØYAKTIG 7 element per veke

Returner BERRE gyldig JSON (ingen markdown):

{
  "custom_shifts": [
    {"name": "D1", "start_time": "07:45", "end_time": "15:15", "hours": 7.5, "description": "..."}
  ],
  "rotation_pattern": ["D1", "D1", "L1", "L1", null, null, "F1", "K2", ...]
}`
            }
          ]
        }
      ],
      response_format: {
        type: 'json_object'
      },
      max_tokens: 4096,
    })

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ GPT-4o responded in ${elapsedTime}s`)
    console.log('📊 Token usage:', {
      prompt: response.usage?.prompt_tokens,
      completion: response.usage?.completion_tokens,
      total: response.usage?.total_tokens
    })

    // Parse response
    const responseText = response.choices[0].message.content || ''
    console.log('📄 Response length:', responseText.length)

    let extracted: ExtractedPlanData

    try {
      extracted = JSON.parse(responseText)
    } catch (e) {
      console.error('❌ Failed to parse GPT-4o JSON:', e)
      console.error('Response:', responseText.substring(0, 500))
      throw new Error('Kunne ikkje parse JSON frå GPT-4o')
    }

    // Validate
    if (!extracted.custom_shifts || !extracted.rotation_pattern || extracted.rotation_pattern.length === 0) {
      throw new Error('Ufullstendig data frå GPT-4o')
    }

    if (extracted.rotation_pattern.length % 7 !== 0) {
      console.warn(`⚠️ Pattern length ${extracted.rotation_pattern.length} not divisible by 7`)
    }

    const weeks = Math.floor(extracted.rotation_pattern.length / 7)
    console.log('✅ Extracted:', {
      custom_shifts: extracted.custom_shifts.length,
      pattern_length: extracted.rotation_pattern.length,
      weeks
    })

    // Track usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: 'turnus_populate_gpt4o',
      tokens_used: response.usage?.total_tokens || 0,
    })

    // Create shifts & rotations (same logic as Claude version)
    const shiftNameToIdMap = new Map<string, string>()
    
    // Create custom shifts
    for (const customShift of extracted.custom_shifts) {
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
        const { data: createdShift } = await supabase
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

        if (createdShift) {
          shiftNameToIdMap.set(customShift.name, createdShift.id)
        }
      }
    }

    // Get all shifts
    const { data: allShifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('plan_id', planId)

    allShifts?.forEach(shift => {
      shiftNameToIdMap.set(shift.name, shift.id)
    })

    // Delete existing rotations
    await supabase.from('rotations').delete().eq('plan_id', planId)

    // Create rotations
    const rotations = []
    for (let i = 0; i < extracted.rotation_pattern.length; i++) {
      const weekIndex = Math.floor(i / 7)
      const dayOfWeek = i % 7
      const shiftName = extracted.rotation_pattern[i]
      
      if (!shiftName) continue
      
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
      await supabase.from('rotations').insert(rotations)
    }

    return NextResponse.json({
      success: true,
      ai_model: 'gpt-4o',
      data: {
        custom_shifts_count: extracted.custom_shifts.length,
        rotation_entries_count: extracted.rotation_pattern.length,
      }
    })

  } catch (error) {
    console.error('💥 GPT-4o processing error:', error)
    return NextResponse.json(
      { 
        error: 'Kunne ikkje prosessere fila med GPT-4o', 
        details: error instanceof Error ? error.message : 'Ukjend feil'
      },
      { status: 500 }
    )
  }
}