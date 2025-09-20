// src/lib/compact-mode-context.tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface CompactModeContextType {
  compactMode: boolean
  toggleCompactMode: () => void
  mounted: boolean
}

const CompactModeContext = createContext<CompactModeContextType | undefined>(undefined)

export function CompactModeProvider({ children }: { children: ReactNode }) {
  const [compactMode, setCompactMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check localStorage after component mounts
    const savedCompactMode = localStorage.getItem('compactMode')
    
    const shouldUseCompactMode = savedCompactMode === 'true'
    
    setCompactMode(shouldUseCompactMode)
  }, [])

  const toggleCompactMode = () => {
    const newCompactMode = !compactMode
    
    setCompactMode(newCompactMode)
    localStorage.setItem('compactMode', newCompactMode.toString())
  }

  return (
    <CompactModeContext.Provider value={{ compactMode, toggleCompactMode, mounted }}>
      {children}
    </CompactModeContext.Provider>
  )
}

export const useCompactMode = () => {
  const context = useContext(CompactModeContext)
  if (context === undefined) {
    // Return safe defaults during SSR
    return { compactMode: false, toggleCompactMode: () => {}, mounted: false }
  }
  return context
}