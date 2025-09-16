export interface Plan {
  id: string
  name: string
  description?: string
  duration_weeks: number
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

export interface Rotation {
  id: string
  plan_id: string
  day_of_week: number // 0 = Sunday, 1 = Monday, etc.
  shift_id: string | null
  created_at: string
  shift?: Shift // populated when joining
}

export interface WeeklyRotation {
  [key: number]: Shift | null // day_of_week -> shift
}