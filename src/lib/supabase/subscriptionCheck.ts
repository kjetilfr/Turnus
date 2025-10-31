// src/lib/supabase/subscriptionCheck.ts
import { createClient } from '@/lib/supabase/server'

export async function checkSubscription() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { hasAccess: false, user: null, subscription: null }
  }

  // Check for active subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const hasAccess = subscription?.status === 'active' || subscription?.status === 'trialing'

  return { hasAccess, user, subscription }
}