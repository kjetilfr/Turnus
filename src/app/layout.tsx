// src/app/layout.tsx - Updated with CompactModeProvider
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { DarkModeProvider } from '@/lib/dark-mode-context'
import { CompactModeProvider } from '@/lib/compact-mode-context'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Turnus Helper!',
  description: 'Built with Next.js and Supabase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DarkModeProvider>
          <CompactModeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </CompactModeProvider>
        </DarkModeProvider>
      </body>
    </html>
  )
}