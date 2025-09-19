// src/lib/norwegian-holidays.ts
export interface NorwegianHoliday {
  date: Date
  name: string
  type: 'fixed' | 'easter-based' | 'moveable'
}

// Calculate Easter Sunday for a given year using the algorithm
function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = Math.floor((h + l - 7 * m + 114) / 31)
  const p = (h + l - 7 * m + 114) % 31
  
  return new Date(year, n - 1, p + 1)
}

// Get all Norwegian holidays for a given year
export function getNorwegianHolidays(year: number): NorwegianHoliday[] {
  const holidays: NorwegianHoliday[] = []
  const easter = getEasterSunday(year)

  // Fixed holidays
  holidays.push(
    { date: new Date(year, 0, 1), name: 'Nyttårsdag', type: 'fixed' },
    { date: new Date(year, 4, 1), name: 'Arbeidernes dag', type: 'fixed' },
    { date: new Date(year, 4, 17), name: 'Grunnlovsdag', type: 'fixed' },
    { date: new Date(year, 11, 25), name: 'Juledag', type: 'fixed' },
    { date: new Date(year, 11, 26), name: 'Annen juledag', type: 'fixed' }
  )

  // Easter-based holidays (calculated relative to Easter Sunday)
  const easterBasedHolidays = [
    { offset: -3, name: 'Skjærtorsdag' }, // Maundy Thursday
    { offset: -2, name: 'Langfredag' }, // Good Friday
    { offset: 0, name: 'Påskedag' }, // Easter Sunday
    { offset: 1, name: 'Annen påskedag' }, // Easter Monday
    { offset: 39, name: 'Kristi himmelfartsdag' }, // Ascension Day
    { offset: 49, name: 'Pinsedag' }, // Whit Sunday
    { offset: 50, name: 'Annen pinsedag' } // Whit Monday
  ]

  easterBasedHolidays.forEach(holiday => {
    const holidayDate = new Date(easter)
    holidayDate.setDate(easter.getDate() + holiday.offset)
    holidays.push({
      date: holidayDate,
      name: holiday.name,
      type: 'easter-based'
    })
  })

  return holidays
}

// Check if a date is a Norwegian holiday
export function isNorwegianHoliday(date: Date): NorwegianHoliday | null {
  const year = date.getFullYear()
  const holidays = getNorwegianHolidays(year)
  
  return holidays.find(holiday => 
    holiday.date.getFullYear() === date.getFullYear() &&
    holiday.date.getMonth() === date.getMonth() &&
    holiday.date.getDate() === date.getDate()
  ) || null
}

// Get holidays within a date range
export function getHolidaysInRange(startDate: Date, endDate: Date): NorwegianHoliday[] {
  const holidays: NorwegianHoliday[] = []
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  
  // Get holidays for all years in the range
  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = getNorwegianHolidays(year)
    holidays.push(...yearHolidays.filter(holiday => 
      holiday.date >= startDate && holiday.date <= endDate
    ))
  }
  
  return holidays
}

// Format date to Norwegian locale string
export function formatNorwegianDate(date: Date): string {
  return date.toLocaleDateString('nb-NO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}