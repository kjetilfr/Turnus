// src/types/lawCheck.ts

import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { Plan } from '@/types/plan'

export type LawCheckCategory = 'main' | 'helping' | 'year' | 'shared'

export type LawCheckLawType = 'aml' | 'hta'

export type LawCheckStatus = 'pass' | 'fail' | 'warning' | 'not_run'

export interface LawCheckInput {
  id: string
  label: string
  type: 'number' | 'text' | 'boolean'
  defaultValue: number | string | boolean
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface LawCheckResult {
  status: LawCheckStatus
  message: string
  details?: string[]
  violations?: Array<{
    weekIndex: number
    dayOfWeek: number
    description: string
  }>
}

export interface LawCheck {
  id: string
  name: string
  description: string
  category: LawCheckCategory
  lawType: LawCheckLawType // 'aml' or 'hta'
  applicableTo?: LawCheckCategory[] // For shared tests: which plan types apply
  inputs?: LawCheckInput[]
  
  // Function to run the check
  run: (params: {
    rotations: Rotation[]
    shifts: Shift[]
    plan: Plan
    inputs?: Record<string, number | string | boolean>
  }) => LawCheckResult
}