// src/lib/utils/norwegianHolidays.ts

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
  
  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }
  
  // Helper to add days to a date
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }
  
  const holidays = [
    {
      date: `${year}-01-01`,
      name: "New Year's Day",
      localName: "Nyttårsdag"
    },
    {
      date: formatDate(addDays(easter, -3)), // Maundy Thursday
      name: "Maundy Thursday",
      localName: "Skjærtorsdag"
    },
    {
      date: formatDate(addDays(easter, -2)), // Good Friday
      name: "Good Friday",
      localName: "Langfredag"
    },
    {
      date: formatDate(easter), // Easter Sunday
      name: "Easter Sunday",
      localName: "Påskedag"
    },
    {
      date: formatDate(addDays(easter, 1)), // Easter Monday
      name: "Easter Monday",
      localName: "Andre påskedag"
    },
    {
      date: `${year}-05-01`,
      name: "Labour Day",
      localName: "Arbeidernes dag"
    },
    {
      date: `${year}-05-17`,
      name: "Constitution Day",
      localName: "Grunnlovsdag"
    },
    {
      date: formatDate(addDays(easter, 39)), // Ascension Day (39 days after Easter)
      name: "Ascension Day",
      localName: "Kristi himmelfartsdag"
    },
    {
      date: formatDate(addDays(easter, 50)), // Whit Monday (50 days after Easter)
      name: "Whit Monday",
      localName: "Pinse"
    },
    {
      date: `${year}-12-25`,
      name: "Christmas Day",
      localName: "Juledag"
    },
    {
      date: `${year}-12-26`,
      name: "St. Stephen's Day",
      localName: "Andre juledag"
    }
  ]
  
  return holidays
}