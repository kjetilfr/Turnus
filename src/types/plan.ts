// src/types/plan.ts

export type PlanType = 'main' | 'helping' | 'year'
export type Tariffavtale = 'ks' | 'staten' | 'oslo' | 'aml'
export type YearPlanMode = 'rotation_based' | 'strict_year'  // ADD THIS LINE

export interface Plan {
  id: string
  user_id: string
  name: string
  description: string | null
  duration_weeks: number
  type: PlanType
  base_plan_id: string | null
  date_started: string // Format: YYYY-MM-DD
  work_percent: number // Work percentage (0-100), default 100
  tariffavtale: Tariffavtale // Tariffavtale type
  year_plan_mode: YearPlanMode | null  // ADD THIS LINE
  created_at: string
  updated_at: string
}

export interface PlanWithBasePlan extends Plan {
  base_plan?: Plan | null
}

export interface CreatePlanData {
  name: string
  description?: string
  duration_weeks: number
  type: PlanType
  base_plan_id?: string
  date_started: string
  work_percent?: number
  tariffavtale?: Tariffavtale
  year_plan_mode?: YearPlanMode  // ADD THIS LINE
}