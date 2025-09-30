// src/types/shift.ts

export interface Shift {
  id: string
  plan_id: string
  name: string
  description: string | null
  start_time: string | null // Format: "HH:MM:SS"
  end_time: string | null // Format: "HH:MM:SS"
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateShiftData {
  plan_id: string
  name: string
  description?: string
  start_time: string
  end_time: string
}

export interface UpdateShiftData {
  name?: string
  description?: string
  start_time?: string
  end_time?: string
}

// Helper function to format time for display
export function formatShiftTime(time: string | null): string {
  if (!time) return '-'
  
  // time is in format "HH:MM:SS", convert to "HH:MM"
  return time.substring(0, 5)
}

// Helper function to format shift display
export function formatShiftDisplay(shift: Shift): string {
  if (shift.is_default) {
    return shift.name
  }
  
  const start = formatShiftTime(shift.start_time)
  const end = formatShiftTime(shift.end_time)
  return `${shift.name} (${start} - ${end})`
}