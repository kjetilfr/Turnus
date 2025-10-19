// src/types/rotation.ts

export interface Rotation {
  id: string
  plan_id: string
  day_of_week: number
  week_index: number
  shift_id: string | null          // Original planned shift
  overlay_shift_id: string | null   // Replacement/overlay shift
  overlay_type: string | null       // Type of overlay
  notes: string | null
  created_at: string
  updated_at: string
}

export type OverlayType = 
  | 'f3_compensation'
  | 'f4_compensation'
  | 'f5_replacement'
  | 'vacation'
  | 'other'

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