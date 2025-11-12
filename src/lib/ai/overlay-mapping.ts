// src/lib/ai/overlay-mapping.ts
// Maps AI shift names to database overlay_type values

export function mapOverlayType(shiftName: string | null): string | null {
  if (!shiftName) return null
  
  switch (shiftName) {
    case 'F3':
      return 'f3_compensation'
    case 'F4':
      return 'f4_compensation'
    case 'F5':
      return 'f5_replacement'
    case 'FE':
      return 'vacation'
    default:
      return null
  }
}