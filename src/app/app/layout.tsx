import { checkSubscription } from '@/lib/supabase/subscriptionCheck'
import { redirect } from 'next/navigation'

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

  // Has access (Pro or Premium tier, active or trialing) - render the app
  return <>{children}</>
}
