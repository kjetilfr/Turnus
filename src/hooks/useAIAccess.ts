// src/hooks/useAIAccess.ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AIAccessResult {
  hasAccess: boolean
  loading: boolean
  tier: string | null
  error: string | null
}

export function useAIAccess(): AIAccessResult {
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAccess() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setHasAccess(false)
          setLoading(false)
          return
        }

        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('tier, status')
          .eq('user_id', user.id)
          .single()

        if (subError) {
          console.error('Error fetching subscription:', subError)
          setError('Kunne ikkje hente abonnementinfo')
          setHasAccess(false)
          setLoading(false)
          return
        }

        const hasAIAccess = 
          subscription?.tier === 'premium' && 
          subscription?.status === 'active'

        setHasAccess(hasAIAccess)
        setTier(subscription?.tier || null)
        setLoading(false)
      } catch (err) {
        console.error('Error in useAIAccess:', err)
        setError('Ein feil oppstod')
        setHasAccess(false)
        setLoading(false)
      }
    }

    checkAccess()
  }, [])

  return { hasAccess, loading, tier, error }
}