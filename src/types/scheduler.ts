// src/types/scheduler.ts
export interface Plan {
  id: string
  name: string
  description?: string
  duration_weeks: number
  plan_type: 'main' | 'helping' // NEW: Plan type field
  user_id: string
  created_at: string
  updated_at: string
}

export interface Shift {
  id: string
  plan_id: string
  name: string
  start_time: string // "09:00:00" format
  end_time: string   // "17:00:00" format
  color: string      // hex color
  created_at: string
}

// Updated Rotation interface to support individual week-day assignments
export interface Rotation {
  id: string
  plan_id: string
  week_index: number // 0 = first week, 1 = second week, etc.
  day_of_week: number // 0 = Sunday, 1 = Monday, etc.
  shift_id: string | null
  created_at: string
  shift?: Shift // populated when joining
}

export interface WeeklyRotation {
  [key: number]: Shift | null // day_of_week -> shift
}

// Helper type for organizing rotations by week and day
export interface WeeklySchedule {
  [weekIndex: number]: {
    [dayOfWeek: number]: Rotation | null
  }
}

// Default shift templates
export const DEFAULT_SHIFTS = [
  { name: 'F1', start_time: '00:00', end_time: '00:00', color: '#F59E0B' },
  { name: 'F2', start_time: '00:00', end_time: '00:00', color: '#F59E0B' },
  { name: 'F3', start_time: '00:00', end_time: '00:00', color: '#F59E0B' },
  { name: 'F4', start_time: '00:00', end_time: '00:00', color: '#F59E0B' },
  { name: 'F5', start_time: '00:00', end_time: '00:00', color: '#F59E0B' },
]

// Plan type display helpers
export const PLAN_TYPE_LABELS = {
  main: 'Main Plan',
  helping: 'Helping Plan'
}

export const PLAN_TYPE_DESCRIPTIONS = {
  main: 'Your primary schedule with full shift rotations',
  helping: 'Additional shifts to help colleagues or cover extra duties'
}