/**
 * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm
 */
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
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  
  return new Date(year, month - 1, day)
}

/**
 * Get Norwegian public holidays for a given year
 */
export function getNorwegianHolidays(year: number): Array<{
  date: string
  name: string
  localName: string
}> {
  const easter = getEasterSunday(year)
  
  // Safe local formatter: uses local date components (avoids toISOString timezone shift)
  const formatDate = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  const holidays = [
    { date: formatDate(new Date(year, 0, 1)), name: "New Year's Day", localName: "Nyttårsdag" },
    { date: formatDate(addDays(easter, -3)), name: "Maundy Thursday", localName: "Skjærtorsdag" },
    { date: formatDate(addDays(easter, -2)), name: "Good Friday", localName: "Langfredag" },
    { date: formatDate(easter), name: "Easter Sunday", localName: "Første påskedag" },
    { date: formatDate(addDays(easter, 1)), name: "Easter Monday", localName: "Andre påskedag" },
    { date: formatDate(new Date(year, 4, 1)), name: "Labour Day", localName: "Arbeidernes dag" },
    { date: formatDate(new Date(year, 4, 17)), name: "Constitution Day", localName: "Grunnlovsdag" },
    { date: formatDate(addDays(easter, 39)), name: "Ascension Day", localName: "Kristi himmelfartsdag" },
    { date: formatDate(addDays(easter, 49)), name: "Whit Sunday", localName: "Første pinsedag" },
    { date: formatDate(addDays(easter, 50)), name: "Whit Monday", localName: "Andre pinsedag" },
    { date: formatDate(new Date(year, 11, 25)), name: "Christmas Day", localName: "Første juledag" },
    { date: formatDate(new Date(year, 11, 26)), name: "St. Stephen's Day", localName: "Andre juledag" }
  ]
  
  return holidays
}
