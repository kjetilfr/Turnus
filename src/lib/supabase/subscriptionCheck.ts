// src/lib/supabase/subscriptionCheck.ts
import { createClient } from '@/lib/supabase/server'

export async function checkSubscription() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { hasAccess: false, user: null, subscription: null }
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Allow access if:
  // 1. Active subscription (Stripe or manual)
  // 2. Trialing subscription
  // 3. Manual grant that hasn't been canceled
  const hasAccess = subscription && (
    subscription.status === 'active' ||
    subscription.status === 'trialing' ||
    (subscription.is_manual && subscription.status !== 'canceled')
  )

  return { hasAccess: !!hasAccess, user, subscription }
}