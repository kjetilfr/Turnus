// src/app/api/stripe/webhook/route.ts - PROPERLY TYPED
import { supabaseAdmin } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

// Define the type for subscription upsert data
interface SubscriptionUpsertData {
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  status: string
  updated_at: string
  current_period_start?: string
  current_period_end?: string
  trial_end?: string
  cancel_at_period_end?: boolean
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('❌ No stripe-signature header found')
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  console.log(`✅ Received event: ${event.type}`)

  const supabase = supabaseAdmin

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        
        if (!userId || !session.customer) {
          console.error('❌ Missing user_id or customer in checkout.session.completed', {
            userId,
            customer: session.customer,
            sessionId: session.id,
            metadata: session.metadata
          })
          return NextResponse.json(
            { error: 'Missing user_id or customer' },
            { status: 400 }
          )
        }

        console.log(`📝 Checkout completed for user: ${userId}`)
        console.log(`   Customer ID: ${session.customer}`)
        console.log(`   Subscription ID: ${session.subscription}`)

        // Create or update subscription record with basic info
        const { data: upsertData, error: upsertError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string || null,
            status: 'incomplete',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          })
          .select()

        if (upsertError) {
          console.error('❌ Error upserting subscription:', upsertError)
          return NextResponse.json(
            { error: 'Database error', details: upsertError.message },
            { status: 500 }
          )
        } else {
          console.log('✅ Subscription record created/updated:', upsertData)
        }

        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        console.log(`📝 Processing ${event.type} for customer: ${customerId}`)
        console.log(`   Subscription ID: ${subscription.id}`)
        console.log(`   Status: ${subscription.status}`)

        // Get user_id from existing subscription record
        const { data: existingSub, error: fetchError } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (fetchError || !existingSub?.user_id) {
          console.error('❌ No user found for customer:', customerId, fetchError)
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          )
        }

        console.log(`   Found user: ${existingSub.user_id}`)

        // Build upsert data with proper typing
        const upsertData: SubscriptionUpsertData = {
          user_id: existingSub.user_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          updated_at: new Date().toISOString(),
        }

        // Add period dates
        if (subscription.items.data[0].current_period_start) {
          upsertData.current_period_start = new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
        }
        
        if (subscription.items.data[0].current_period_end) {
          upsertData.current_period_end = new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        }

        // Add trial end if exists
        if (subscription.trial_end) {
          upsertData.trial_end = new Date(subscription.trial_end * 1000).toISOString()
        }

        // Add cancel_at_period_end
        if (subscription.cancel_at_period_end !== undefined) {
          upsertData.cancel_at_period_end = subscription.cancel_at_period_end
        }

        console.log('📊 Upserting subscription data:', {
          user_id: upsertData.user_id,
          status: upsertData.status,
          subscription_id: upsertData.stripe_subscription_id,
        })

        const { data: updatedData, error: updateError } = await supabase
          .from('subscriptions')
          .upsert(upsertData, {
            onConflict: 'user_id'
          })
          .select()

        if (updateError) {
          console.error('❌ Error updating subscription:', updateError)
          return NextResponse.json(
            { error: 'Database error', details: updateError.message },
            { status: 500 }
          )
        } else {
          console.log(`✅ Subscription updated successfully:`, updatedData)
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        console.log(`📝 Subscription deleted: ${subscription.id}`)

        const { data: updatedData, error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
          .select()

        if (updateError) {
          console.error('❌ Error marking subscription as canceled:', updateError)
        } else {
          console.log('✅ Subscription marked as canceled:', updatedData)
        }

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        console.log(`💰 Payment succeeded for customer: ${customerId}`)

        // Payment succeeded - ensure subscription is active
        const { data: updatedData, error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
          .select()

        if (updateError) {
          console.error('❌ Error updating subscription to active:', updateError)
        } else {
          console.log('✅ Subscription marked as active:', updatedData)
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        console.log(`❌ Payment failed for customer: ${customerId}`)

        const { data: updatedData, error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
          .select()

        if (updateError) {
          console.error('❌ Error updating subscription to past_due:', updateError)
        } else {
          console.log('⚠️ Subscription marked as past_due:', updatedData)
        }

        break
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('💥 Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}