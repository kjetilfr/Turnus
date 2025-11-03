// src/app/api/ai/upload-pdf/route.ts - IMPROVED VERSION
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

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

  // Get the uploaded PDF file
  const formData = await request.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
  }

  // Check file size (limit to 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  try {
    // Convert PDF to base64 for Claude
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Send to Claude for extraction
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

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
              text: `Analyze this Norwegian turnusplan (shift schedule) PDF and extract ALL information.

Extract and return as JSON in this exact format:

{
  "plan_name": "Name of the turnusplan",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "rotation_pattern": ["D", "D", "D", "A", "A", "N", "N", "F", "F", "F"],
  "shifts": [
    {
      "date": "YYYY-MM-DD",
      "shift_type": "D" | "A" | "N" | "F",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "hours": 7.5
    }
  ]
}

Shift types in Norwegian healthcare:
- D = Dag (day shift, usually 07:00-15:00, 7.5 hours)
- A = Aften (evening shift, usually 15:00-23:00, 8 hours)
- N = Natt (night shift, usually 23:00-07:00, 8 hours)
- F = Fri (day off, 0 hours)

Important:
1. Extract the rotation pattern if visible (the repeating sequence of shifts)
2. Calculate exact dates for each shift
3. If start_time/end_time not visible, use standard times above
4. Ensure all dates are sequential and cover the full period
5. Return ONLY valid JSON, no other text or explanations`,
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
      throw new Error('Could not extract JSON from Claude response')
    }

    const extracted = JSON.parse(jsonMatch[0])

    // Validate extracted data
    if (!extracted.plan_name || !extracted.start_date || !extracted.shifts || extracted.shifts.length === 0) {
      throw new Error('Incomplete data extracted from PDF')
    }

    // Track AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: 'pdf_upload',
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
      })
      .select()
      .single()

    if (planError) throw planError

    // Create all shifts
    const shiftsToInsert = extracted.shifts.map((shift: any) => ({
      plan_id: plan.id,
      date: shift.date,
      shift_type: shift.shift_type,
      start_time: shift.start_time,
      end_time: shift.end_time,
      hours: shift.hours,
    }))

    const { error: shiftsError } = await supabase
      .from('shifts')
      .insert(shiftsToInsert)

    if (shiftsError) throw shiftsError

    // If rotation pattern was extracted, create rotation
    if (extracted.rotation_pattern && extracted.rotation_pattern.length > 0) {
      const { error: rotationError } = await supabase
        .from('rotations')
        .insert({
          plan_id: plan.id,
          pattern: extracted.rotation_pattern,
          start_date: extracted.start_date,
        })

      if (rotationError) {
        console.error('Error creating rotation:', rotationError)
        // Don't fail the whole request if rotation creation fails
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
        start_date: extracted.start_date,
        end_date: extracted.end_date,
        shift_count: extracted.shifts.length,
        rotation_pattern: extracted.rotation_pattern,
      }
    })

  } catch (error) {
    console.error('PDF processing error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process PDF', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}