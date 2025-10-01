// src/lib/lawChecks/index.ts

import { LawCheck } from '@/types/lawCheck'

// Import shared checks
import { f1RestPeriodCheck } from './shared/F1RestPeriodCheck'

// Import main plan checks
// import { exampleMainCheck } from './main/ExampleMainCheck'

// Import helping plan checks
// import { exampleHelpingCheck } from './helping/ExampleHelpingCheck'

// Import year plan checks
// import { exampleYearCheck } from './year/ExampleYearCheck'

/**
 * All law checks organized by category
 */
export const LAW_CHECKS: LawCheck[] = [
  // Shared checks
  f1RestPeriodCheck,
  
  // Main plan checks
  // exampleMainCheck,
  
  // Helping plan checks
  // exampleHelpingCheck,
  
  // Year plan checks
  // exampleYearCheck,
]

/**
 * Get checks by category
 */
export function getChecksByCategory(category: 'main' | 'helping' | 'year' | 'shared'): LawCheck[] {
  return LAW_CHECKS.filter(check => check.category === category)
}

/**
 * Get all categories that have checks
 */
export function getAvailableCategories(): Array<{ id: string; label: string; count: number }> {
  const categories = [
    { id: 'shared', label: 'Shared Tests', count: 0 },
    { id: 'main', label: 'Main Plan Tests', count: 0 },
    { id: 'helping', label: 'Helping Plan Tests', count: 0 },
    { id: 'year', label: 'Year Plan Tests', count: 0 },
  ]

  LAW_CHECKS.forEach(check => {
    const cat = categories.find(c => c.id === check.category)
    if (cat) cat.count++
  })

  return categories.filter(c => c.count > 0)
}

/**
 * Get a specific check by ID
 */
export function getCheckById(id: string): LawCheck | undefined {
  return LAW_CHECKS.find(check => check.id === id)
}