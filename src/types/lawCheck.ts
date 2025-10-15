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
  showIf?: {
    field: string
    equals: any
  }
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

export interface LawReference {
  title: string
  url: string
}

export interface LawCheck {
  id: string
  name: string
  description: string
  category: LawCheckCategory
  lawType: LawCheckLawType
  lawReferences?: LawReference[]
  applicableTo?: LawCheckCategory[]
  inputs?: LawCheckInput[]
  
  // Function to run the check
  run: (params: {
    rotations: Rotation[]
    shifts: Shift[]
    plan: Plan
    inputs?: Record<string, number | string | boolean>
    basePlanRotations?: Rotation[]
    basePlanShifts?: Shift[]
    basePlan?: Plan  // ADD THIS - the full base plan object
  }) => LawCheckResult
}