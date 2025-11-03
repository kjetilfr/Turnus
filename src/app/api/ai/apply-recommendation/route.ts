// src/app/api/ai/apply-recommendation/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ProposedChange {
  date: string
  current_shift: string
  proposed_shift: string
  reason: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { planId, changes } = await request.json() as {
      planId: string
      changes: ProposedChange[]
    }

    if (!planId || !changes || changes.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify plan belongs to user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('user_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Apply each change
    const results = []
    for (const change of changes) {
      // Get shift type details for the proposed shift
      let startTime = '00:00'
      let endTime = '00:00'
      let hours = 0

      switch (change.proposed_shift) {
        case 'D': // Day shift
          startTime = '07:00'
          endTime = '15:00'
          hours = 7.5
          break
        case 'A': // Evening shift
          startTime = '15:00'
          endTime = '23:00'
          hours = 8
          break
        case 'N': // Night shift
          startTime = '23:00'
          endTime = '07:00'
          hours = 8
          break
        case 'F': // Free day
          startTime = '00:00'
          endTime = '00:00'
          hours = 0
          break
      }

      // Update or create the shift
      const { data: existingShift } = await supabase
        .from('shifts')
        .select('id')
        .eq('plan_id', planId)
        .eq('date', change.date)
        .maybeSingle()

      if (existingShift) {
        // Update existing shift
        const { error: updateError } = await supabase
          .from('shifts')
          .update({
            shift_type: change.proposed_shift,
            start_time: startTime,
            end_time: endTime,
            hours: hours,
          })
          .eq('id', existingShift.id)

        if (updateError) {
          console.error('Error updating shift:', updateError)
          results.push({ date: change.date, success: false, error: updateError.message })
        } else {
          results.push({ date: change.date, success: true })
        }
      } else {
        // Create new shift
        const { error: insertError } = await supabase
          .from('shifts')
          .insert({
            plan_id: planId,
            date: change.date,
            shift_type: change.proposed_shift,
            start_time: startTime,
            end_time: endTime,
            hours: hours,
          })

        if (insertError) {
          console.error('Error creating shift:', insertError)
          results.push({ date: change.date, success: false, error: insertError.message })
        } else {
          results.push({ date: change.date, success: true })
        }
      }
    }

    // Check if all changes were successful
    const allSuccessful = results.every(r => r.success)
    const successCount = results.filter(r => r.success).length

    return NextResponse.json({
      success: allSuccessful,
      applied: successCount,
      total: changes.length,
      results,
    })

  } catch (error) {
    console.error('Apply recommendation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to apply changes', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}