// src/app/api/ai/apply-improvements/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ProposedChange {
  week_index: number
  day_of_week: number
  current_shift_id: string | null
  proposed_shift_id: string | null
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
      // Check if rotation exists for this week/day
      const { data: existingRotation } = await supabase
        .from('rotations')
        .select('id')
        .eq('plan_id', planId)
        .eq('week_index', change.week_index)
        .eq('day_of_week', change.day_of_week)
        .maybeSingle()

      if (existingRotation) {
        // Update existing rotation
        const updateData = {
          shift_id: change.proposed_shift_id,
          overlay_shift_id: null, // Clear any overlays when making improvements
          overlay_type: null
        }

        const { error: updateError } = await supabase
          .from('rotations')
          .update(updateData)
          .eq('id', existingRotation.id)

        if (updateError) {
          console.error('Error updating rotation:', updateError)
          results.push({ 
            week: change.week_index, 
            day: change.day_of_week, 
            success: false, 
            error: updateError.message 
          })
        } else {
          results.push({ 
            week: change.week_index, 
            day: change.day_of_week, 
            success: true 
          })
        }
      } else if (change.proposed_shift_id) {
        // Create new rotation if proposing to add a shift to an empty day
        const { error: insertError } = await supabase
          .from('rotations')
          .insert({
            plan_id: planId,
            week_index: change.week_index,
            day_of_week: change.day_of_week,
            shift_id: change.proposed_shift_id,
            overlay_shift_id: null,
            overlay_type: null
          })

        if (insertError) {
          console.error('Error creating rotation:', insertError)
          results.push({ 
            week: change.week_index, 
            day: change.day_of_week, 
            success: false, 
            error: insertError.message 
          })
        } else {
          results.push({ 
            week: change.week_index, 
            day: change.day_of_week, 
            success: true 
          })
        }
      } else {
        // No rotation exists and no shift proposed - skip
        results.push({ 
          week: change.week_index, 
          day: change.day_of_week, 
          success: true,
          skipped: true
        })
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
    console.error('Apply improvements error:', error)
    return NextResponse.json(
      { 
        error: 'Kunne ikkje bruke endringar', 
        details: error instanceof Error ? error.message : 'Ukjend feil' 
      },
      { status: 500 }
    )
  }
}