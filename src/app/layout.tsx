// src/app/app/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkSubscription } from '@/lib/supabase/subscriptionCheck'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { hasAccess, user } = await checkSubscription()

  // Not logged in - redirect to login
  if (!user) {
    redirect('/login')
  }

  // Logged in but no subscription - redirect to pricing/paywall
  if (!hasAccess) {
    redirect('/subscribe')
  }

  // Has access - render the app
  return <>{children}</>
}