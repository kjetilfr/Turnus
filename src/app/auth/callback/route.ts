import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      // Ensure next path starts with /
      const nextPath = next.startsWith('/') ? next : `/${next}`
      
      if (isLocalEnv) {
        // Local development
        return NextResponse.redirect(`${origin}${nextPath}`)
      } else {
        // Production - always use custom domain
        const productionDomain = process.env.NEXT_PUBLIC_SITE_URL || 'https://turnus-hjelp.no'
        return NextResponse.redirect(`${productionDomain}${nextPath}`)
      }
    }
  }

  // Return the user to an error page with instructions
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const errorRedirect = isLocalEnv 
    ? `${origin}/auth/auth-code-error` 
    : `${process.env.NEXT_PUBLIC_SITE_URL || 'https://turnus-hjelp.no'}/auth/auth-code-error`
  return NextResponse.redirect(errorRedirect)
}