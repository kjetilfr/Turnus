// src/types/plan.ts

export type PlanType = 'main' | 'helping' | 'year'

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
}