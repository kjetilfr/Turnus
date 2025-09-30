// src/types/rotation.ts

export interface Rotation {
  id: string
  plan_id: string
  day_of_week: number // 0 = Monday, 6 = Sunday
  week_index: number
  shift_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RotationGridData {
  [weekIndex: number]: {
    [dayOfWeek: number]: Rotation
  }
}

export const DAY_NAMES = [
  'Monday',
  'Tuesday', 
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const

export const DAY_NAMES_SHORT = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun'
] as const