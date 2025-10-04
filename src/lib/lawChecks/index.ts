// src/lib/lawChecks/index.ts

import { LawCheck, LawCheckLawType, LawCheckCategory } from '@/types/lawCheck'

// Import all checks from this directory
import { f1RestPeriodCheck } from './F1RestPeriodCheck'
import { averageWorkHoursCheck } from './AverageWorkHoursCheck'
import { compensatingRestCheck } from './CompensatingRestChecks'

/**
 * All law checks
 * Add new checks to this array as you create them
 */
export const LAW_CHECKS: LawCheck[] = [
  f1RestPeriodCheck,
  averageWorkHoursCheck,
  compensatingRestCheck,
  // Add more checks here as you create them
]

/**
 * Get checks by law type (aml or hta)
 */
export function getChecksByLawType(lawType: LawCheckLawType): LawCheck[] {
  return LAW_CHECKS.filter(check => check.lawType === lawType)
}

/**
 * Get checks by law type and plan type
 * For shared checks, only return if they're applicable to the given plan type
 */
export function getChecksByLawTypeAndPlan(
  lawType: LawCheckLawType, 
  planType: LawCheckCategory
): LawCheck[] {
  return LAW_CHECKS.filter(check => {
    // Must match law type
    if (check.lawType !== lawType) return false
    
    // If it's a shared check, verify it applies to this plan type
    if (check.category === 'shared') {
      return check.applicableTo?.includes(planType) ?? false
    }
    
    // If it's a specific category check, it must match the plan type
    return check.category === planType
  })
}

/**
 * Get all law types that have checks
 */
export function getAvailableLawTypes(): Array<{ id: LawCheckLawType; label: string; count: number }> {
  const lawTypes: Array<{ id: LawCheckLawType; label: string; count: number }> = [
    { id: 'aml', label: 'AML (Arbeidsmiljøloven)', count: 0 },
    { id: 'hta', label: 'HTA (Hovedtariffavtalen)', count: 0 },
  ]

  LAW_CHECKS.forEach(check => {
    const lawType = lawTypes.find(lt => lt.id === check.lawType)
    if (lawType) lawType.count++
  })

  return lawTypes.filter(lt => lt.count > 0)
}

/**
 * Get a specific check by ID
 */
export function getCheckById(id: string): LawCheck | undefined {
  return LAW_CHECKS.find(check => check.id === id)
}