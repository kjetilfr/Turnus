// src/app/api/ai/opulate-turnus-gpt4o/route.ts - WITH OVERLAY MAPPING
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { getGPT4oPrompt } from '@/lib/ai/prompts'
import { mapOverlayType } from '@/lib/ai/overlay-mapping'

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

    // Create message with base64 file
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: getGPT4oPrompt()
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

    // Create shifts & rotations (same logic as Claude)
    const shiftNameToIdMap = new Map<string, string>()
    
    // Create custom shifts
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

    console.log('📋 Available shifts in map:', Array.from(shiftNameToIdMap.keys()))

    // Delete existing rotations
    await supabase.from('rotations').delete().eq('plan_id', planId)

    // Create rotations from pattern
    const rotations = []
    let currentWeek = 0
    
    for (let i = 0; i < extracted.rotation_pattern.length; i++) {
      const entry = extracted.rotation_pattern[i]
      
      // Detect week boundaries
      if (i > 0) {
        const prevEntry = extracted.rotation_pattern[i - 1]
        if (prevEntry.day === 6 && entry.day === 0) {
          currentWeek++
        }
      }
      
      // Get shift IDs
      const shiftId = entry.shift ? shiftNameToIdMap.get(entry.shift) : null
      const overlayShiftId = entry.overlay ? shiftNameToIdMap.get(entry.overlay) : null
      
      // Map overlay name to database overlay_type
      const overlayType = mapOverlayType(entry.overlay)
      
      // Debug logging
      if (entry.shift) {
        console.log(`Day ${entry.day}: shift="${entry.shift}" (ID: ${shiftId || 'NOT FOUND'}), overlay="${entry.overlay}" → overlay_type="${overlayType}" (ID: ${overlayShiftId || 'NOT FOUND'})`)
      }
      
      // Skip if completely empty
      if (!shiftId && !overlayShiftId) {
        continue
      }
      
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