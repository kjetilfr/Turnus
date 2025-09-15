'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface DarkModeContextType {
  darkMode: boolean
  toggleDarkMode: () => void
  mounted: boolean
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined)

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Apply dark mode to document
  const applyDarkMode = (isDark: boolean) => {
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      console.log('Applied dark mode:', isDark, 'Classes:', document.documentElement.classList.toString())
    }
  }

  useEffect(() => {
    setMounted(true)
    
    // Check localStorage after component mounts
    const savedDarkMode = localStorage.getItem('darkMode')
    console.log('Saved dark mode from localStorage:', savedDarkMode)
    
    const shouldUseDarkMode = savedDarkMode === 'true'
    
    setDarkMode(shouldUseDarkMode)
    applyDarkMode(shouldUseDarkMode)
  }, [])

  // Watch for darkMode state changes and apply them
  useEffect(() => {
    if (mounted) {
      applyDarkMode(darkMode)
    }
  }, [darkMode, mounted])

  const toggleDarkMode = () => {
    console.log('Toggling dark mode. Current:', darkMode, 'New:', !darkMode)
    const newDarkMode = !darkMode
    
    setDarkMode(newDarkMode)
    localStorage.setItem('darkMode', newDarkMode.toString())
    applyDarkMode(newDarkMode)
    
    console.log('Dark mode toggled to:', newDarkMode)
  }

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, mounted }}>
      {children}
    </DarkModeContext.Provider>
  )
}

export const useDarkMode = () => {
  const context = useContext(DarkModeContext)
  if (context === undefined) {
    // Return safe defaults during SSR
    return { darkMode: false, toggleDarkMode: () => {}, mounted: false }
  }
  return context
}