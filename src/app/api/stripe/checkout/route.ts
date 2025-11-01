// src/app/api/stripe/checkout/route.ts - IMPROVED (Adds metadata everywhere)
import { createClient } from '@/lib/supabase/server'
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

    console.log('Creating checkout for user:', user.id, user.email)

    // Check if user already has a Stripe customer
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let customerId = existingSubscription?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id, // IMPORTANT: Add metadata here too!
        },
      })
      customerId = customer.id
      console.log('Created new Stripe customer:', customerId)
    } else {
      console.log('Using existing Stripe customer:', customerId)
      
      // ADDED: Update existing customer to ensure metadata is set
      await stripe.customers.update(customerId, {
        metadata: {
          supabase_user_id: user.id,
        },
      })
      console.log('Updated customer metadata for:', customerId)
    }

    // Create checkout session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          supabase_user_id: user.id, // Metadata in subscription
        },
      },
      // Metadata in checkout session
      metadata: {
        supabase_user_id: user.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/app?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/subscribe?checkout=cancelled`,
      allow_promotion_codes: true,
    })

    console.log('Checkout session created:', session.id, 'for user:', user.id)

    // Return the URL instead of sessionId
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}