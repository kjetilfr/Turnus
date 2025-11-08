// src/lib/admin/checkAdmin.ts
import { createClient } from '@/lib/supabase/server'


/**
 * Check if the current user is an admin
 * Reads from raw_user_meta_data.is_admin field
 * This is the same approach used for articles admin access
 */
export async function checkIsAdmin() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.log('❌ No authenticated user')
    return { isAdmin: false, user: null }
  }

  console.log('✅ User authenticated:', user.email)

  // Check if user has is_admin = true in raw_user_meta_data
  // This is the same pattern used in your articles policies
  const isAdmin = user.user_metadata?.is_admin === true

  console.log('🔍 Admin check:', {
    userId: user.id,
    email: user.email,
    metadata: user.user_metadata,
    isAdmin
  })

  return { isAdmin, user }
}

export async function returnUserType() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Check if user has active subscription (Pro user)
  let isPro = false
  if (user) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, tier')
      .eq('user_id', user.id)
      .maybeSingle()
    
    isPro = subscription?.tier === 'pro' && (subscription?.status === 'active' || subscription?.status === 'trialing')
  }
  // Check if user has active subscription (Pro user)
  let isPremium = false
  if (user) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, tier')
      .eq('user_id', user.id)
      .maybeSingle()
    
    isPremium = subscription?.tier === 'premium' && (subscription?.status === 'active' || subscription?.status === 'trialing')
  }
  if (isPro) {
    return "pro"
  } else if (isPremium) {
    return "premium"
  } else {
    return "false"
  }
}

export async function isSubscribed() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Check if user has active subscription (Pro user)
  let isSubscribed = false
  if (user) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, tier')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if ((subscription?.tier === 'pro' || subscription?.tier === 'premium') && (subscription?.status === 'active' || subscription?.status === 'trialing')) {
      isSubscribed = true
    }
  }
  return isSubscribed
}