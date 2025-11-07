// src/app/api/ai/populate-turnus/route.ts - Populates existing plan with AI
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
                media_type: mediaType as any,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are analyzing a Norwegian healthcare turnus/shift schedule document.

**CRITICAL: Day-of-Week Positioning Rules**

Norwegian turnus documents show weekly schedules with 7 columns representing:
1. Man (Monday)
2. Tir (Tuesday) 
3. Ons (Wednesday)
4. Tor (Thursday)
5. Fre (Friday)
6. Lør (Saturday)
7. Søn (Sunday)

**IMPORTANT**: 
- Empty columns mean NO SHIFT on that day - NOT that the day doesn't exist
- You MUST preserve the exact column/position for each shift
- Count from left to right starting at Monday (0) to Sunday (6)
- If a shift code appears in the 7th column, it is SUNDAY, even if previous columns are empty

**Example Parsing:**
Input:  "D1    D1    L1    L1         F1"
Means:  [D1, D1, L1, L1, null, null, F1]
Days:   Mon  Tue  Wed  Thu  Fri   Lør   Søn

NOT:    [D1, D1, L1, L1, F1, null, null]  ❌ WRONG!

**Document Structure:**

1. Header with employee info
2. Weekly schedule table with format:
   Uke [number]: [date range] | Man | Tir | Ons | Tor | Fre | Lør | Søn | Timer
3. Vaktkode (shift code) definitions table
4. Optional comments

**Your Task:**

1. Extract vaktkode definitions (custom shifts) from the vaktkode table
2. Parse the weekly schedule, **PRESERVING EXACT COLUMN POSITIONS**
3. Map each shift to its correct date by:
   - Start with the week's start date (Monday)
   - For each of the 7 day columns (0-6):
     - If column has shift code → create shift for that date
     - If column is empty → skip to next day
   - Increment date by 1 for each column

**Return JSON Format:**

{
  "plan_name": "Employee name and ID",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD", 
  "employee_name": "Name if visible",
  "work_percent": 100,
  "duration_weeks": 52,
  "custom_shifts": [
    {
      "name": "D1",
      "start_time": "07:45",
      "end_time": "15:15", 
      "hours": 7.5,
      "description": "Dagvakt"
    }
  ],
  "shifts": [
    {
      "date": "2025-12-08",
      "shift_type": "D1",
      "day_of_week": 0,
      "start_time": "07:45",
      "end_time": "15:15",
      "hours": 7.5
    },
    {
      "date": "2025-12-09", 
      "shift_type": "D1",
      "day_of_week": 1,
      "start_time": "07:45",
      "end_time": "15:15",
      "hours": 7.5
    },
    {
      "date": "2025-12-14",
      "shift_type": "F1",
      "day_of_week": 6,
      "start_time": "00:00",
      "end_time": "00:00",
      "hours": 0
    }
  ]
}

**Field Descriptions:**

- **day_of_week**: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
  - This helps verify you've parsed the correct day
  - If day_of_week doesn't match the date's actual day, you've made an error

- **shifts**: One entry per scheduled shift
  - Skip empty days entirely (don't create shift entries)
  - Each shift must have the date that corresponds to its column position
  - F1/FE shifts have 0 hours

**Special Cases:**

1. **FE (Ferie/Vacation)**: These may show as "(K1) FE" meaning overlay or just FE
   - If (K1) FE first add shift in parenthesis then overlay with FE if no parantheses just add FE overlay

2. **F3 (Compensation days)**: May show as just "F3" 
   - Create shift with type "F3"

3. **F5 (Extra)**: shown as (K1) AF5
   - Create the shift in paranthesis and then add F5 as overlay

**Validation Rules:**

✅ DO:
- Preserve exact column positions
- Create shifts only for days with shift codes
- Calculate correct dates based on week start + day offset
- Include day_of_week for verification

❌ DON'T:
- Shift codes to fill gaps
- Assume consecutive days all have shifts
- Place Sunday shifts on Friday
- Create shifts for empty columns

**Return only valid JSON with no other text or explanations.**`,
            },
          ],
        },
      ],
    })

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Kunne ikkje ekstrahere JSON frå Claude sitt svar')
    }

    const extracted = JSON.parse(jsonMatch[0]) as ExtractedPlanData

    // Validate extracted data
    if (!extracted.custom_shifts || !extracted.rotation_pattern || extracted.rotation_pattern.length === 0) {
      throw new Error('Ufullstendig data ekstrahert frå dokumentet')
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