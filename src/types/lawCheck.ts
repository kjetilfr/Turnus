// src/types/lawCheck.ts

export type LawCheckCategory = 'main' | 'helping' | 'year' | 'shared'

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
  inputs?: LawCheckInput[]
  
  // Function to run the check
  run: (params: {
    rotations: any[]
    shifts: any[]
    plan: any
    inputs?: Record<string, number | string | boolean>
  }) => LawCheckResult
}