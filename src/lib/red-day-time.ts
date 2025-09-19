// src/lib/red-day-time.ts
import { getNorwegianHolidays, type NorwegianHoliday } from './norwegian-holidays'

export interface RedDayTimeRange {
  holiday: NorwegianHoliday
  startTime: Date
  endTime: Date
  type: 'standard' | 'may_special' | 'major_holiday'
}

/**
 * Calculate the "red day time" for Norwegian holidays
 * 
 * Rules:
 * - Most holidays: 18:00 Saturday until 22:00 Sunday
 * - 1. May and 17. May: 22:00 the day before until 22:00 on the holiday
 * - Major holidays (Juledag, Påskedag, Pinsedag): 15:00 the day before until end of holiday
 */
export function getRedDayTimeRanges(year: number): RedDayTimeRange[] {
  const holidays = getNorwegianHolidays(year)
  const redDayRanges: RedDayTimeRange[] = []

  holidays.forEach(holiday => {
    const range = calculateRedDayTime(holiday)
    if (range) {
      redDayRanges.push(range)
    }
  })

  return redDayRanges
}

function calculateRedDayTime(holiday: NorwegianHoliday): RedDayTimeRange | null {
  const holidayDate = new Date(holiday.date)
  
  // Special cases for May holidays
  if (holiday.name === 'Arbeidernes dag' || holiday.name === 'Grunnlovsdag') {
    const startTime = new Date(holidayDate)
    startTime.setDate(holidayDate.getDate() - 1)
    startTime.setHours(22, 0, 0, 0)
    
    const endTime = new Date(holidayDate)
    endTime.setHours(22, 0, 0, 0)
    
    return {
      holiday,
      startTime,
      endTime,
      type: 'may_special'
    }
  }
  
  // Major holidays that start at 15:00 the day before
  if (holiday.name === 'Juledag' || holiday.name === 'Påskedag' || holiday.name === 'Pinsedag') {
    const startTime = new Date(holidayDate)
    startTime.setDate(holidayDate.getDate() - 1)
    startTime.setHours(15, 0, 0, 0)
    
    const endTime = new Date(holidayDate)
    endTime.setHours(23, 59, 59, 999)
    
    return {
      holiday,
      startTime,
      endTime,
      type: 'major_holiday'
    }
  }
  
  // Standard red day time: 18:00 Saturday until 22:00 Sunday
  // Find the Saturday before the holiday
  const dayOfWeek = holidayDate.getDay() // 0 = Sunday, 1 = Monday, etc.
  const daysUntilSaturday = dayOfWeek === 0 ? 1 : (6 - dayOfWeek) // Days back to previous Saturday
  
  const startTime = new Date(holidayDate)
  startTime.setDate(holidayDate.getDate() - daysUntilSaturday)
  startTime.setHours(18, 0, 0, 0)
  
  // End time is 22:00 on the Sunday after the Saturday
  const endTime = new Date(startTime)
  endTime.setDate(startTime.getDate() + 1) // Sunday
  endTime.setHours(22, 0, 0, 0)
  
  return {
    holiday,
    startTime,
    endTime,
    type: 'standard'
  }
}

/**
 * Check if a given datetime falls within any red day time range
 */
export function isWithinRedDayTime(dateTime: Date, year?: number): RedDayTimeRange | null {
  const checkYear = year || dateTime.getFullYear()
  const redDayRanges = getRedDayTimeRanges(checkYear)
  
  return redDayRanges.find(range => 
    dateTime >= range.startTime && dateTime <= range.endTime
  ) || null
}

/**
 * Get all red day time ranges within a date range
 */
export function getRedDayTimeRangesInPeriod(startDate: Date, endDate: Date): RedDayTimeRange[] {
  const ranges: RedDayTimeRange[] = []
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  
  for (let year = startYear; year <= endYear; year++) {
    const yearRanges = getRedDayTimeRanges(year)
    ranges.push(...yearRanges.filter(range => 
      range.endTime >= startDate && range.startTime <= endDate
    ))
  }
  
  return ranges
}

/**
 * Format red day time range for display
 */
export function formatRedDayTimeRange(range: RedDayTimeRange): string {
  const startStr = range.startTime.toLocaleDateString('nb-NO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  const endStr = range.endTime.toLocaleDateString('nb-NO', {
    weekday: 'short', 
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  return `${range.holiday.name}: ${startStr} - ${endStr}`
}

/**
 * Test function to console log red day time calculations for a helping plan
 */
export function testRedDayTimesForHelpingPlan(
  startDate: Date, 
  durationWeeks: number,
  planName: string
): void {
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + (durationWeeks * 7) - 1)
  
  console.log(`🔴 Red Day Time Analysis for Helping Plan: "${planName}"`)
  console.log('=' .repeat(60))
  console.log(`📅 Plan Period: ${startDate.toLocaleDateString('nb-NO')} - ${endDate.toLocaleDateString('nb-NO')}`)
  console.log(`⏰ Duration: ${durationWeeks} week${durationWeeks !== 1 ? 's' : ''} (${durationWeeks * 7} days)`)
  console.log('')
  
  const redDayRanges = getRedDayTimeRangesInPeriod(startDate, endDate)
  
  if (redDayRanges.length === 0) {
    console.log('✅ No red day periods found within this plan period.')
    return
  }
  
  console.log(`📋 Found ${redDayRanges.length} red day period${redDayRanges.length !== 1 ? 's' : ''} during plan:`)
  
  redDayRanges.forEach((range, index) => {
    console.log(`\n${index + 1}. 🎄 ${range.holiday.name} (${range.type})`)
    console.log(`   Holiday Date: ${range.holiday.date.toLocaleDateString('nb-NO', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    })}`)
    console.log(`   🟥 Red Time Start: ${range.startTime.toLocaleString('nb-NO')}`)
    console.log(`   🟥 Red Time End:   ${range.endTime.toLocaleString('nb-NO')}`)
    
    const duration = (range.endTime.getTime() - range.startTime.getTime()) / (1000 * 60 * 60)
    console.log(`   ⏱️  Duration: ${duration.toFixed(1)} hours`)
    
    // Check if red time overlaps with plan period
    const overlapStart = new Date(Math.max(range.startTime.getTime(), startDate.getTime()))
    const overlapEnd = new Date(Math.min(range.endTime.getTime(), endDate.getTime()))
    const overlapHours = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60))
    
    if (overlapHours > 0) {
      console.log(`   📊 Overlap with plan: ${overlapHours.toFixed(1)} hours`)
      console.log(`       From: ${overlapStart.toLocaleString('nb-NO')}`)
      console.log(`       To:   ${overlapEnd.toLocaleString('nb-NO')}`)
    }
    
    // Show the rule applied
    switch (range.type) {
      case 'may_special':
        console.log(`   📏 Rule: 22:00 day before until 22:00 on holiday (1./17. May)`)
        break
      case 'major_holiday':
        console.log(`   📏 Rule: 15:00 day before until end of holiday (Juledag/Påskedag/Pinsedag)`)
        break
      case 'standard':
        console.log(`   📏 Rule: 18:00 Saturday until 22:00 Sunday (standard holiday)`)
        break
    }
  })
  
  // Summary statistics
  const totalRedHours = redDayRanges.reduce((total, range) => {
    const overlapStart = new Date(Math.max(range.startTime.getTime(), startDate.getTime()))
    const overlapEnd = new Date(Math.min(range.endTime.getTime(), endDate.getTime()))
    const overlapHours = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60))
    return total + overlapHours
  }, 0)
  
  console.log(`\n📊 Summary for "${planName}":`)
  console.log(`   • Total red day periods: ${redDayRanges.length}`)
  console.log(`   • Total red hours in plan: ${totalRedHours.toFixed(1)} hours`)
  console.log(`   • Types: ${redDayRanges.filter(r => r.type === 'standard').length} standard, ${redDayRanges.filter(r => r.type === 'may_special').length} May special, ${redDayRanges.filter(r => r.type === 'major_holiday').length} major holidays`)
  console.log(`   • Plan coverage: ${((totalRedHours / (durationWeeks * 7 * 24)) * 100).toFixed(1)}% of plan time is "red"`)
}

/**
 * General test function to console log red day time calculations for any year
 */
export function testRedDayTimes(year: number = new Date().getFullYear()): void {
  console.log(`🔴 Red Day Time Analysis for ${year}`)
  console.log('=' .repeat(50))
  
  const redDayRanges = getRedDayTimeRanges(year)
  
  redDayRanges.forEach((range, index) => {
    console.log(`\n${index + 1}. ${range.holiday.name} (${range.type})`)
    console.log(`   Holiday Date: ${range.holiday.date.toLocaleDateString('nb-NO', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    })}`)
    console.log(`   Red Time Start: ${range.startTime.toLocaleString('nb-NO')}`)
    console.log(`   Red Time End:   ${range.endTime.toLocaleString('nb-NO')}`)
    
    const duration = (range.endTime.getTime() - range.startTime.getTime()) / (1000 * 60 * 60)
    console.log(`   Duration: ${duration.toFixed(1)} hours`)
    
    // Show the rule applied
    switch (range.type) {
      case 'may_special':
        console.log(`   Rule: 22:00 day before until 22:00 on holiday`)
        break
      case 'major_holiday':
        console.log(`   Rule: 15:00 day before until end of holiday`)
        break
      case 'standard':
        console.log(`   Rule: 18:00 Saturday until 22:00 Sunday`)
        break
    }
  })
  
  console.log(`\n📊 Summary: ${redDayRanges.length} red day periods found`)
  console.log(`Types: ${redDayRanges.filter(r => r.type === 'standard').length} standard, ${redDayRanges.filter(r => r.type === 'may_special').length} May special, ${redDayRanges.filter(r => r.type === 'major_holiday').length} major holidays`)
}