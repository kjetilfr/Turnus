// src/app/api/stripe/checkout/route.ts - WITH AI TIER SUPPORT
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

    // Get tier from request body (default to 'pro')
    const { tier = 'pro' } = await request.json()
    
    // Validate tier
    if (!['pro', 'premium'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier' },
        { status: 400 }
      )
    }

    console.log('Creating checkout for user:', user.id, user.email, 'tier:', tier)

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
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
      console.log('Created new Stripe customer:', customerId)
    } else {
      console.log('Using existing Stripe customer:', customerId)
      
      await stripe.customers.update(customerId, {
        metadata: {
          supabase_user_id: user.id,
        },
      })
      console.log('Updated customer metadata for:', customerId)
    }

    // Select the correct price ID based on tier
    const priceId = tier === 'premium' 
      ? process.env.STRIPE_PREMIUM_PRICE_ID 
      : process.env.STRIPE_PRO_PRICE_ID

    if (!priceId) {
      console.error(`Missing price ID for tier: ${tier}`)
      return NextResponse.json(
        { error: 'Configuration error' },
        { status: 500 }
      )
    }

    // Create checkout session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          supabase_user_id: user.id,
          tier: tier, // Store tier in subscription metadata
        },
      },
      metadata: {
        supabase_user_id: user.id,
        tier: tier, // Store tier in checkout metadata
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/app?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/subscribe?checkout=cancelled`,
      allow_promotion_codes: true,
    })

    console.log('Checkout session created:', session.id, 'for user:', user.id, 'tier:', tier)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}