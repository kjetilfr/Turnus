// src/app/api/admin/grant-subscription/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/service'
import { checkIsAdmin } from '@/lib/admin/checkAdmin'

export async function POST(request: Request) {
  try {
    // Check if requester is admin
    const { isAdmin, user: adminUser } = await checkIsAdmin()
    
    if (!isAdmin || !adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const { userId, tier, durationDays = 365 } = await request.json()

    if (!userId || !tier) {
      return NextResponse.json(
        { error: 'userId and tier are required' },
        { status: 400 }
      )
    }

    if (!['pro', 'premium'].includes(tier)) {
      return NextResponse.json(
        { error: 'tier must be either "pro" or "premium"' },
        { status: 400 }
      )
    }

    console.log(`Admin ${adminUser.email} granting ${tier} subscription to user ${userId}`)

    // Calculate dates
    const now = new Date()
    const endDate = new Date(now)
    endDate.setDate(endDate.getDate() + durationDays)

    // Check if user already has a subscription
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingSub) {
      // Update existing subscription
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          tier: tier,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: endDate.toISOString(),
          updated_at: now.toISOString(),
          is_manual: true,
          manual_granted_by: adminUser.id,
          manual_granted_at: now.toISOString(),
        })
        .eq('user_id', userId)

      if (updateError) {
        console.error('Error updating subscription:', updateError)
        return NextResponse.json(
          { error: 'Failed to update subscription' },
          { status: 500 }
        )
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier: tier,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: endDate.toISOString(),
          is_manual: true,
          manual_granted_by: adminUser.id,
          manual_granted_at: now.toISOString(),
        })

      if (insertError) {
        console.error('Error creating subscription:', insertError)
        return NextResponse.json(
          { error: 'Failed to create subscription' },
          { status: 500 }
        )
      }
    }

    console.log(`✅ Successfully granted ${tier} subscription to user ${userId}`)

    return NextResponse.json({
      success: true,
      message: `${tier} subscription granted successfully`,
      duration_days: durationDays,
      expires_at: endDate.toISOString(),
    })
  } catch (error) {
    console.error('Grant subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}