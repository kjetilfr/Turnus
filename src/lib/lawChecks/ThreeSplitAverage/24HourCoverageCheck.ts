import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'

/**
 * Check if rotations provide 24-hour coverage
 * Only considers non-default shifts (excludes F1-F5)
 */
export function check24HourCoverage(rotations: Rotation[], shifts: Shift[]): boolean {
  const timeRanges: Array<{ start: number; end: number }> = []

  rotations.forEach((rotation: Rotation) => {
    if (rotation.shift_id) {
      const shift = shifts.find((s: Shift) => s.id === rotation.shift_id)
      
      // Skip default shifts (F1-F5)
      if (!shift || shift.is_default || !shift.start_time || !shift.end_time) return

      const parseTime = (time: string) => {
        const [h, m] = time.split(':').map(Number)
        return h * 60 + m
      }

      const startMinutes = parseTime(shift.start_time)
      const endMinutes = parseTime(shift.end_time)

      if (endMinutes < startMinutes) {
        // Night shift - split into two ranges
        timeRanges.push({ start: startMinutes, end: 24 * 60 })
        timeRanges.push({ start: 0, end: endMinutes })
      } else {
        timeRanges.push({ start: startMinutes, end: endMinutes })
      }
    }
  })

  if (timeRanges.length === 0) return false

  // Sort and merge overlapping ranges
  timeRanges.sort((a, b) => a.start - b.start)
  const mergedRanges: Array<{ start: number; end: number }> = [timeRanges[0]]

  for (let i = 1; i < timeRanges.length; i++) {
    const current = timeRanges[i]
    const last = mergedRanges[mergedRanges.length - 1]

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      return false // Gap found
    }
  }

  return mergedRanges.length === 1 &&
    mergedRanges[0].start === 0 &&
    mergedRanges[0].end === 24 * 60
}