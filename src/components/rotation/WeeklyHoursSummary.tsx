// src/components/rotation/WeeklyHoursSummary.tsx
'use client'

interface WeeklyHoursSummaryProps {
  totalHours: number
  durationWeeks: number
  workPercent: number
}

export default function WeeklyHoursSummary({ 
  totalHours, 
  durationWeeks, 
  workPercent 
}: WeeklyHoursSummaryProps) {
  // Calculate expected weekly hours based on work percentage
  const expectedWeeklyHours = 35.5 * (workPercent / 100)
  
  // Calculate actual average weekly hours
  const actualWeeklyHours = totalHours / durationWeeks
  
  // Calculate difference (negative = working too much, positive = working too little)
  // SWAPPED: positive shows hours UNTIL desired, negative shows hours OVER desired
  const difference = expectedWeeklyHours - actualWeeklyHours
  
  // Determine status
  const isOverworking = difference < -0.1 // Working more than 0.1h extra per week
  const isUnderworking = difference > 0.1 // Working less than 0.1h per week
  const isBalanced = !isOverworking && !isUnderworking

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            className="text-blue-500 hover:text-blue-700"
            title="Average weekly hours: Shows actual hours worked per week compared to expected hours based on work percentage"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          
          <div className="font-mono font-semibold text-gray-900">
            {actualWeeklyHours.toFixed(1)}h / {expectedWeeklyHours.toFixed(1)}h ({workPercent}%)
          </div>
          
          <div className={`px-2 py-0.5 rounded font-semibold ${
            isBalanced 
              ? 'bg-green-100 text-green-800' 
              : isOverworking 
                ? 'bg-red-100 text-red-800' 
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {difference > 0 ? '+' : ''}{difference.toFixed(1)}h
          </div>
          
          <button
            type="button"
            className={`${
              isBalanced 
                ? 'text-green-500 hover:text-green-700' 
                : isOverworking 
                  ? 'text-red-500 hover:text-red-700' 
                  : 'text-yellow-500 hover:text-yellow-700'
            }`}
            title={
              isOverworking 
                ? `⚠️ Negative (${difference.toFixed(1)}h): You are working ${Math.abs(difference).toFixed(1)} hours MORE per week than expected`
                : isUnderworking
                  ? `ℹ️ Positive (+${difference.toFixed(1)}h): You need ${difference.toFixed(1)} more hours per week to reach expected hours`
                  : '✓ Your weekly hours are balanced'
            }
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Warning for Overworking - Compact */}
      {isOverworking && (
        <div className="mt-2 pt-2 border-t border-red-200 flex items-start gap-2">
          <svg className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-red-900">
            <span className="font-semibold">Warning:</span> Working {Math.abs(difference).toFixed(1)}h/week over {workPercent}% position. Review for compliance.
          </p>
        </div>
      )}
    </div>
  )
}