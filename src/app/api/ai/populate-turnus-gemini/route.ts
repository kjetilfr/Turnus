// src/app/api/ai/populate-turnus-gemini/route.ts - Gemini version
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Define types
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

const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/rtf',
  'text/rtf'
]

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.rtf']

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
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Google AI API key ikkje konfigurert' },
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

    // Determine MIME type
    let mimeType = 'application/pdf'
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    } else if (file.type === 'application/msword') {
      mimeType = 'application/msword'
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })

    console.log('🤖 Calling Gemini API...')
    console.log('📄 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB')

    const startTime = Date.now()

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      },
      `Du analyserer eit norsk turnusdokument frå helsesektoren.

**VIKTIG: Tell kolonnane NØYE**

Kvar veke-rad har EKSAKT 7 kolonnar separert med |:
Kolonne 1=Man, 2=Tir, 3=Ons, 4=Tor, 5=Fre, 6=Lør, 7=Søn

**Eksempel:**
Uke 50: | D1 | D1 | L1 | L1 | | | F1

Tell kvar kolonne:
1=D1, 2=D1, 3=L1, 4=L1, 5=TOM, 6=TOM, 7=F1

Output: ["D1", "D1", "L1", "L1", null, null, "F1"]

**Reglar:**
- ALLTID 7 element per veke
- Tom kolonne || = null
- F1 kan vere på kva som helst dag
- FE: Fjern parentesar "(K1) FE" → "FE"

Returner JSON:
{
  "custom_shifts": [{"name": "D1", "start_time": "07:45", "end_time": "15:15", "hours": 7.5}],
  "rotation_pattern": ["D1", "D1", null, ...]
}`
    ])

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ Gemini responded in ${elapsedTime}s`)

    const responseText = result.response.text()
    console.log('📄 Response length:', responseText.length)

    let extracted: ExtractedPlanData

    try {
      extracted = JSON.parse(responseText)
    } catch (e) {
      console.error('❌ Failed to parse Gemini JSON:', e)
      throw new Error('Kunne ikkje parse JSON frå Gemini')
    }

    // Validate
    if (!extracted.custom_shifts || !extracted.rotation_pattern || extracted.rotation_pattern.length === 0) {
      throw new Error('Ufullstendig data frå Gemini')
    }

    const weeks = Math.floor(extracted.rotation_pattern.length / 7)
    console.log('✅ Extracted:', {
      custom_shifts: extracted.custom_shifts.length,
      pattern_length: extracted.rotation_pattern.length,
      weeks
    })

    // Track usage (Gemini doesn't provide token count easily)
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: 'turnus_populate_gemini',
      tokens_used: 0, // Gemini doesn't expose this easily
    })

    // Create shifts & rotations (same logic)
    const shiftNameToIdMap = new Map<string, string>()
    
    for (const customShift of extracted.custom_shifts) {
      if (['F', 'F1', 'F2', 'F3', 'F4', 'F5'].includes(customShift.name)) continue

      const { data: existingShift } = await supabase
        .from('shifts')
        .select('id')
        .eq('plan_id', planId)
        .eq('name', customShift.name)
        .maybeSingle()

      if (existingShift) {
        await supabase.from('shifts').update({
          description: customShift.description,
          start_time: customShift.start_time,
          end_time: customShift.end_time,
        }).eq('id', existingShift.id)
        
        shiftNameToIdMap.set(customShift.name, existingShift.id)
      } else {
        const { data: createdShift } = await supabase.from('shifts').insert({
          plan_id: planId,
          name: customShift.name,
          description: customShift.description,
          start_time: customShift.start_time,
          end_time: customShift.end_time,
          is_default: false,
        }).select().single()

        if (createdShift) {
          shiftNameToIdMap.set(customShift.name, createdShift.id)
        }
      }
    }

    const { data: allShifts } = await supabase.from('shifts').select('*').eq('plan_id', planId)
    allShifts?.forEach(shift => shiftNameToIdMap.set(shift.name, shift.id))

    await supabase.from('rotations').delete().eq('plan_id', planId)

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
      ai_model: 'gemini-1.5-pro',
      data: {
        custom_shifts_count: extracted.custom_shifts.length,
        rotation_entries_count: extracted.rotation_pattern.length,
      }
    })

  } catch (error) {
    console.error('💥 Gemini processing error:', error)
    return NextResponse.json(
      { 
        error: 'Kunne ikkje prosessere fila med Gemini', 
        details: error instanceof Error ? error.message : 'Ukjend feil'
      },
      { status: 500 }
    )
  }
}