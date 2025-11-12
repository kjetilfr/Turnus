// src/app/api/ai/populate-turnus-gemini/route.ts - WITH OVERLAY MAPPING
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiPrompt } from '@/lib/ai/prompts'
import { mapOverlayType } from '@/lib/ai/overlay-mapping'

// Define types
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
  const geminiModel = formData.get('geminiModel') as string || 'gemini-2.0-flash-exp'
  
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

    // Validate and use the selected Gemini model
    const validModels = ['gemini-2.0-flash-exp', 'gemini-2.5-flash', 'gemini-2.5-pro']
    const selectedModel = validModels.includes(geminiModel) ? geminiModel : 'gemini-2.0-flash-exp'

    // Model fallback chain
    const modelFallbacks: Record<string, string[]> = {
      'gemini-2.5-pro': ['gemini-2.5-flash', 'gemini-2.0-flash-exp'],
      'gemini-2.5-flash': ['gemini-2.0-flash-exp'],
      'gemini-2.0-flash-exp': []
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    
    console.log(`🤖 Attempting Gemini API with model: ${selectedModel}`)
    console.log('📄 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB')

    const startTime = Date.now()

    // Retry logic with model fallback
    let result = null
    let actualModelUsed = selectedModel
    let lastError: Error | null = null
    const maxRetries = 2
    
    const modelsToTry = [
      ...Array(maxRetries).fill(selectedModel),
      ...(modelFallbacks[selectedModel] || [])
    ]
    
    for (let i = 0; i < modelsToTry.length; i++) {
      actualModelUsed = modelsToTry[i]
      
      try {
        console.log(`🔄 Attempt ${i + 1}/${modelsToTry.length} with model: ${actualModelUsed}`)
        
        const model = genAI.getGenerativeModel({ 
          model: actualModelUsed,
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })

        result = await model.generateContent([
          {
            inlineData: {
              data: base64,
              mimeType: mimeType
            }
          },
          getGeminiPrompt()
        ])
        
        console.log(`✅ Success with model: ${actualModelUsed}`)
        break
        
      } catch (error) {
        lastError = error as Error
        console.error(`❌ Attempt ${i + 1} failed with ${actualModelUsed}:`, error)
        
        const is503 = error instanceof Error && error.message.includes('503')
        const is429 = error instanceof Error && error.message.includes('429')
        
        if (is503 || is429) {
          console.log(`⚠️ Model ${actualModelUsed} is overloaded or rate limited`)
          
          const waitTime = Math.min(1000 * Math.pow(2, i), 5000)
          console.log(`⏳ Waiting ${waitTime}ms before next attempt...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
        
        if (i === modelsToTry.length - 1) {
          throw lastError
        }
      }
    }

    if (!result) {
      throw lastError || new Error('All model attempts failed')
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ Gemini responded in ${elapsedTime}s using ${actualModelUsed}`)

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

    // Track usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: `turnus_populate_${actualModelUsed}`,
      tokens_used: 0,
    })

    // Create shifts & rotations
    const shiftNameToIdMap = new Map<string, string>()
    
    for (const customShift of extracted.custom_shifts) {
      if (['F', 'F1', 'F2', 'F3', 'F4', 'F5', 'FE'].includes(customShift.name)) {
        console.log(`⏭️ Skipping standard F-shift: ${customShift.name}`)
        continue
      }

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

    console.log('📋 Available shifts in map:', Array.from(shiftNameToIdMap.keys()))

    await supabase.from('rotations').delete().eq('plan_id', planId)

    // Create rotations
    const rotations = []
    let currentWeek = 0
    
    for (let i = 0; i < extracted.rotation_pattern.length; i++) {
      const entry = extracted.rotation_pattern[i]
      
      if (i > 0) {
        const prevEntry = extracted.rotation_pattern[i - 1]
        if (prevEntry.day === 6 && entry.day === 0) {
          currentWeek++
        }
      }
      
      const shiftId = entry.shift ? shiftNameToIdMap.get(entry.shift) : null
      const overlayShiftId = entry.overlay ? shiftNameToIdMap.get(entry.overlay) : null
      
      // Map overlay name to database overlay_type
      const overlayType = mapOverlayType(entry.overlay)
      
      // Debug logging
      if (entry.shift || entry.overlay) {
        console.log(`Day ${entry.day}: shift="${entry.shift}" (ID: ${shiftId || 'NOT FOUND'}), overlay="${entry.overlay}" → overlay_type="${overlayType}" (ID: ${overlayShiftId || 'NOT FOUND'})`)
      }
      
      if (!shiftId && !overlayShiftId) continue
      
      rotations.push({
        plan_id: planId,
        week_index: currentWeek,
        day_of_week: entry.day,
        shift_id: shiftId,
        overlay_shift_id: overlayShiftId,
        overlay_type: overlayType,
      })
    }

    console.log(`📅 Created ${rotations.length} rotation entries across ${currentWeek + 1} weeks`)

    if (rotations.length > 0) {
      await supabase.from('rotations').insert(rotations)
    }

    return NextResponse.json({
      success: true,
      ai_model: actualModelUsed,
      data: {
        custom_shifts_count: extracted.custom_shifts.length,
        rotation_entries_count: extracted.rotation_pattern.length,
      }
    })

  } catch (error) {
    console.error('💥 Gemini processing error:', error)
    
    let userMessage = 'Kunne ikkje prosessere fila med Gemini'
    let isModelBusy = false
    
    if (error instanceof Error) {
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        userMessage = '⚠️ Gemini-modellen er oppteken for augneblinken. Alle modellar er overlasta.'
        isModelBusy = true
      } else if (error.message.includes('429')) {
        userMessage = 'For mange førespurnader. Vent eit minutt og prøv igjen.'
      } else if (error.message.includes('404')) {
        userMessage = 'Modellen er ikkje tilgjengeleg. Prøv ein annan Gemini-versjon eller ein annan AI-modell.'
      }
    }
    
    return NextResponse.json(
      { 
        error: userMessage, 
        details: error instanceof Error ? error.message : 'Ukjend feil',
        suggestion: isModelBusy 
          ? '💡 Prøv ein av desse i staden: GPT-4o (anbefalt) eller Claude' 
          : 'Prøv å velje "Auto" eller "GPT-4o" som modell i staden.',
        modelBusy: isModelBusy,
        busyModel: 'actualModelUsed'
      },
      { status: 503 }
    )
  }
}