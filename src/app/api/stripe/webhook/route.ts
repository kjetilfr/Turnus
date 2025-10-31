// src/app/api/stripe/webhook/route.ts
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
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

  const supabase = await createClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
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

        // Create or update subscription record with basic info
        // The subscription.created event will fill in the detailed info
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string || null,
            status: 'incomplete',
            updated_at: new Date().toISOString(),
          })

        console.log('Checkout completed for user:', userId)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer as string

        // Get user_id from existing subscription record
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!existingSub?.user_id) {
          console.error('No user found for customer:', customerId)
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          )
        }

        // Log the subscription object to see what properties it has
        console.log('Subscription object:', JSON.stringify(subscription, null, 2))

        await supabase
          .from('subscriptions')
          .upsert({
            user_id: existingSub.user_id,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            // @ts-ignore - API version might have different property names
            current_period_start: new Date((subscription.current_period_start || subscription.currentPeriodStart) * 1000).toISOString(),
            // @ts-ignore - API version might have different property names
            current_period_end: new Date((subscription.current_period_end || subscription.currentPeriodEnd) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })

        console.log('Subscription updated:', subscription.id, 'Status:', subscription.status)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer as string

        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        console.log('Subscription canceled:', subscription.id)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const customerId = invoice.customer as string

        // Payment succeeded - ensure subscription is active
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        console.log('Payment succeeded for customer:', customerId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer as string

        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        console.log('Payment failed for customer:', customerId)
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
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