// src/app/api/stripe/checkout/route.ts - WITH SUBSCRIPTION LIMIT
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

    // ✅ CHECK FOR EXISTING ACTIVE SUBSCRIPTION
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Block if user has an active subscription
    if (existingSubscription) {
      const activeStatuses = ['active', 'trialing', 'past_due']
      
      if (activeStatuses.includes(existingSubscription.status)) {
        console.log('User already has active subscription:', existingSubscription.status)
        return NextResponse.json(
          { 
            error: 'You already have an active subscription. Please cancel your current subscription before subscribing to a different plan.',
            currentStatus: existingSubscription.status
          },
          { status: 409 } // 409 Conflict
        )
      }

      // If subscription is canceled or incomplete, allow new checkout
      // but we'll check Stripe to make sure there's no active subscription there
      if (existingSubscription.stripe_customer_id) {
        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: existingSubscription.stripe_customer_id,
            status: 'active',
            limit: 1
          })

          if (subscriptions.data.length > 0) {
            console.log('Found active subscription in Stripe that DB missed')
            return NextResponse.json(
              { 
                error: 'You have an active subscription in Stripe. Please cancel it first.',
              },
              { status: 409 }
            )
          }
        } catch (stripeError) {
          console.error('Error checking Stripe subscriptions:', stripeError)
          // Continue anyway - we'll let Stripe handle duplicate prevention
        }
      }
    }

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
          tier: tier,
        },
      },
      metadata: {
        supabase_user_id: user.id,
        tier: tier,
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