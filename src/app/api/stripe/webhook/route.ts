// src/app/api/stripe/webhook/route.ts - FIXED VERSION
import { supabaseAdmin } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('No stripe-signature header found')
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
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  console.log(`Received event: ${event.type}`)

 const supabase = supabaseAdmin

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        
        if (!userId || !session.customer) {
          console.error('Missing user_id or customer in checkout.session.completed', {
            userId,
            customer: session.customer,
            sessionId: session.id
          })
          return NextResponse.json(
            { error: 'Missing user_id or customer' },
            { status: 400 }
          )
        }

        console.log(`Checkout completed for user: ${userId}`)

        // Create or update subscription record with basic info
        const { error: upsertError } = await supabase
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

        if (upsertError) {
          console.error('Error upserting subscription:', upsertError)
        }

        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        console.log(`Processing ${event.type} for customer: ${customerId}`)

        // Get user_id from existing subscription record
        const { data: existingSub, error: fetchError } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (fetchError || !existingSub?.user_id) {
          console.error('No user found for customer:', customerId, fetchError)
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          )
        }

        // Build the upsert data object safely
        const upsertData: any = {
          user_id: existingSub.user_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          updated_at: new Date().toISOString(),
        }

        // Safely add period dates
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
        upsertData.cancel_at_period_end = subscription.cancel_at_period_end || false

        const { error: updateError } = await supabase
          .from('subscriptions')
          .upsert(upsertData, {
            onConflict: 'user_id'
          })

        if (updateError) {
          console.error('Error updating subscription:', updateError)
        } else {
          console.log(`Subscription updated: ${subscription.id}, Status: ${subscription.status}`)
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        console.log(`Subscription deleted: ${subscription.id}`)

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        if (updateError) {
          console.error('Error marking subscription as canceled:', updateError)
        }

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        console.log(`Payment succeeded for customer: ${customerId}`)

        // Payment succeeded - ensure subscription is active
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        if (updateError) {
          console.error('Error updating subscription to active:', updateError)
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        console.log(`Payment failed for customer: ${customerId}`)

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        if (updateError) {
          console.error('Error updating subscription to past_due:', updateError)
        }

        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}