// src/app/api/account/delete/route.ts - FIXED TypeScript errors
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🗑️ Starting account deletion for user:', user.id)

    // Step 1: Get subscription info before deleting
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Step 2: Cancel Stripe subscription if exists
    if (subscription?.stripe_subscription_id) {
      try {
        console.log('💳 Canceling Stripe subscription:', subscription.stripe_subscription_id)
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
        console.log('✅ Stripe subscription canceled')
      } catch (stripeError) {
        console.error('⚠️ Error canceling Stripe subscription:', stripeError)
        // Continue with deletion even if Stripe fails
      }
    }

    // Step 3: Delete Stripe customer if exists
    if (subscription?.stripe_customer_id) {
      try {
        console.log('💳 Deleting Stripe customer:', subscription.stripe_customer_id)
        await stripe.customers.del(subscription.stripe_customer_id)
        console.log('✅ Stripe customer deleted')
      } catch (stripeError) {
        console.error('⚠️ Error deleting Stripe customer:', stripeError)
        // Continue with deletion even if Stripe fails
      }
    }

    // Step 4: Get all plan IDs for this user (to delete related data)
    const { data: userPlans } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('user_id', user.id)

    const planIds = userPlans?.map(p => p.id) || []

    console.log(`📋 Found ${planIds.length} plans to delete`)

    // Step 5: Delete all user data from database (in correct order due to foreign keys)
    
    if (planIds.length > 0) {
      // Delete rotations (depends on plans)
      const { error: rotationsError } = await supabaseAdmin
        .from('rotations')
        .delete()
        .in('plan_id', planIds)
      
      if (rotationsError) {
        console.error('⚠️ Error deleting rotations:', rotationsError)
      } else {
        console.log('✅ Rotations deleted')
      }

      // Delete shifts (depends on plans)
      const { error: shiftsError } = await supabaseAdmin
        .from('shifts')
        .delete()
        .in('plan_id', planIds)
      
      if (shiftsError) {
        console.error('⚠️ Error deleting shifts:', shiftsError)
      } else {
        console.log('✅ Shifts deleted')
      }
    }

    // Delete plans
    const { error: plansError } = await supabaseAdmin
      .from('plans')
      .delete()
      .eq('user_id', user.id)
    
    if (plansError) {
      console.error('⚠️ Error deleting plans:', plansError)
    } else {
      console.log('✅ Plans deleted')
    }

    // Delete subscription record
    const { error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('user_id', user.id)
    
    if (subscriptionError) {
      console.error('⚠️ Error deleting subscription:', subscriptionError)
    } else {
      console.log('✅ Subscription record deleted')
    }

    // Step 6: Delete the auth user (this also handles auth.users table)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    
    if (deleteUserError) {
      console.error('❌ Error deleting auth user:', deleteUserError)
      return NextResponse.json(
        { error: 'Failed to delete account', details: deleteUserError.message },
        { status: 500 }
      )
    }

    console.log('✅ User auth account deleted')
    console.log('🎉 Account deletion complete for user:', user.id)

    return NextResponse.json({ 
      success: true,
      message: 'Account deleted successfully'
    })

  } catch (error) {
    console.error('💥 Account deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete account', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}