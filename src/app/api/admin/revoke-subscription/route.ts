// src/app/api/admin/revoke-subscription/route.ts
import { NextResponse } from 'next/server'
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

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    console.log(`Admin ${adminUser.email} revoking subscription for user ${userId}`)

    // Check if subscription is manual
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this user' },
        { status: 404 }
      )
    }

    if (!subscription.is_manual) {
      return NextResponse.json(
        { error: 'Can only revoke manually granted subscriptions. Use Stripe portal for Stripe subscriptions.' },
        { status: 400 }
      )
    }

    // Revoke the subscription
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error revoking subscription:', updateError)
      return NextResponse.json(
        { error: 'Failed to revoke subscription' },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully revoked subscription for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Subscription revoked successfully',
    })
  } catch (error) {
    console.error('Revoke subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}