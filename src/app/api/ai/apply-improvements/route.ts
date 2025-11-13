// src/app/api/ai/apply-improvements/route.ts - FIXED with better error handling
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Set max duration for database operations
export const maxDuration = 60

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
    const body = await request.json()
    const { planId, changes } = body as {
      planId: string
      changes: ProposedChange[]
    }

    if (!planId || !changes || !Array.isArray(changes)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (changes.length === 0) {
      return NextResponse.json(
        { error: 'No changes to apply' },
        { status: 400 }
      )
    }

    console.log(`📝 Applying ${changes.length} changes to plan ${planId}`)

    // Verify plan belongs to user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('user_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      console.error('Plan not found:', planError)
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Apply each change with better error handling
    const results = []
    const errors = []
    let successCount = 0
    let failureCount = 0

    for (const change of changes) {
      try {
        console.log(`  Applying change: Week ${change.week_index + 1}, Day ${change.day_of_week}`)
        
        // Validate change data
        if (typeof change.week_index !== 'number' || typeof change.day_of_week !== 'number') {
          throw new Error('Invalid week_index or day_of_week')
        }

        // Check if rotation exists for this week/day
        const { data: existingRotation, error: fetchError } = await supabase
          .from('rotations')
          .select('id')
          .eq('plan_id', planId)
          .eq('week_index', change.week_index)
          .eq('day_of_week', change.day_of_week)
          .maybeSingle()

        if (fetchError) {
          throw new Error(`Database error: ${fetchError.message}`)
        }

        if (existingRotation) {
          // Update existing rotation
          if (change.proposed_shift_id === null) {
            // Delete the rotation if proposing null shift
            const { error: deleteError } = await supabase
              .from('rotations')
              .delete()
              .eq('id', existingRotation.id)

            if (deleteError) {
              throw new Error(`Delete error: ${deleteError.message}`)
            }

            console.log(`    ✓ Deleted rotation for Week ${change.week_index + 1}, Day ${change.day_of_week}`)
          } else {
            // Update the rotation
            const updateData = {
              shift_id: change.proposed_shift_id,
              overlay_shift_id: null, // Clear any overlays when making improvements
              overlay_type: null,
              updated_at: new Date().toISOString()
            }

            const { error: updateError } = await supabase
              .from('rotations')
              .update(updateData)
              .eq('id', existingRotation.id)

            if (updateError) {
              throw new Error(`Update error: ${updateError.message}`)
            }

            console.log(`    ✓ Updated rotation for Week ${change.week_index + 1}, Day ${change.day_of_week}`)
          }

          results.push({ 
            week: change.week_index, 
            day: change.day_of_week, 
            success: true,
            action: change.proposed_shift_id === null ? 'deleted' : 'updated'
          })
          successCount++
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
              overlay_type: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (insertError) {
            throw new Error(`Insert error: ${insertError.message}`)
          }

          console.log(`    ✓ Created rotation for Week ${change.week_index + 1}, Day ${change.day_of_week}`)
          results.push({ 
            week: change.week_index, 
            day: change.day_of_week, 
            success: true,
            action: 'created'
          })
          successCount++
        } else {
          // No rotation exists and no shift proposed - skip
          console.log(`    ⏭ Skipped Week ${change.week_index + 1}, Day ${change.day_of_week} (no change needed)`)
          results.push({ 
            week: change.week_index, 
            day: change.day_of_week, 
            success: true,
            skipped: true,
            action: 'skipped'
          })
        }
      } catch (changeError) {
        console.error(`    ❌ Failed for Week ${change.week_index + 1}, Day ${change.day_of_week}:`, changeError)
        
        const errorMessage = changeError instanceof Error ? changeError.message : 'Unknown error'
        errors.push({
          week: change.week_index,
          day: change.day_of_week,
          error: errorMessage
        })
        
        results.push({ 
          week: change.week_index, 
          day: change.day_of_week, 
          success: false, 
          error: errorMessage 
        })
        failureCount++
      }
    }

    // Check if all changes were successful
    const allSuccessful = failureCount === 0

    console.log(`📊 Applied ${successCount}/${changes.length} changes successfully`)
    if (failureCount > 0) {
      console.log(`❌ ${failureCount} changes failed`)
    }

    // Track AI usage for applied improvements (simplified without metadata)
    const { error: trackingError } = await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: 'rotation_improvements_applied',
      tokens_used: 0 // No tokens used for applying changes
    })
    
    if (trackingError) {
      console.error('Failed to track AI usage:', trackingError)
      // Don't fail the request if tracking fails
    }

    // Return response with detailed results
    const response = {
      success: allSuccessful,
      applied: successCount,
      failed: failureCount,
      total: changes.length,
      results,
    }

    if (errors.length > 0) {
      return NextResponse.json({
        ...response,
        errors,
        warning: 'Some changes could not be applied'
      }, { status: allSuccessful ? 200 : 207 }) // 207 Multi-Status for partial success
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('💥 Apply improvements error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : error)
    
    return NextResponse.json(
      { 
        error: 'Kunne ikkje bruke endringar', 
        details: error instanceof Error ? error.message : 'Ukjend feil' 
      },
      { status: 500 }
    )
  }
}