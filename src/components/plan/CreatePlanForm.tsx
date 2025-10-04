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
  const difference = actualWeeklyHours - expectedWeeklyHours
  
  // Determine status
  const isOverworking = difference < -0.1 // Working more than 0.1h extra per week
  const isUnderworking = difference > 0.1 // Working less than 0.1h per week
  const isBalanced = !isOverworking && !isUnderworking

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Average Weekly Hours</h3>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600"
          title="This shows your average weekly hours compared to your expected hours based on work percentage"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Actual Hours */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-600 mb-1">Actual Average</div>
          <div className="text-2xl font-bold text-gray-900">
            {actualWeeklyHours.toFixed(1)}h
          </div>
          <div className="text-xs text-gray-500 mt-1">per week</div>
        </div>

        {/* Expected Hours */}
        <div className="bg-indigo-50 rounded-lg p-4">
          <div className="text-xs font-medium text-indigo-700 mb-1">
            Expected ({workPercent}%)
          </div>
          <div className="text-2xl font-bold text-indigo-900">
            {expectedWeeklyHours.toFixed(1)}h
          </div>
          <div className="text-xs text-indigo-600 mt-1">per week</div>
        </div>

        {/* Difference */}
        <div className={`rounded-lg p-4 ${
          isBalanced 
            ? 'bg-green-50' 
            : isOverworking 
              ? 'bg-red-50' 
              : 'bg-yellow-50'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`text-xs font-medium ${
              isBalanced 
                ? 'text-green-700' 
                : isOverworking 
                  ? 'text-red-700' 
                  : 'text-yellow-700'
            }`}>
              Difference
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
                  ? '⚠️ Negative difference means you are working TOO MANY hours per week on average'
                  : isUnderworking
                    ? 'ℹ️ Positive difference means you are working TOO FEW hours per week on average'
                    : '✓ Your weekly hours are balanced'
              }
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
          <div className={`text-2xl font-bold ${
            isBalanced 
              ? 'text-green-900' 
              : isOverworking 
                ? 'text-red-900' 
                : 'text-yellow-900'
          }`}>
            {difference > 0 ? '+' : ''}{difference.toFixed(1)}h
          </div>
          <div className={`text-xs mt-1 font-medium ${
            isBalanced 
              ? 'text-green-600' 
              : isOverworking 
                ? 'text-red-600' 
                : 'text-yellow-600'
          }`}>
            {isBalanced && '✓ Balanced'}
            {isOverworking && '⚠️ Overworking'}
            {isUnderworking && 'ℹ️ Underworking'}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Hours:</span>
            <span className="font-semibold text-gray-900">{totalHours.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Duration:</span>
            <span className="font-semibold text-gray-900">{durationWeeks} weeks</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Calculation:</span>
            <span className="font-mono text-xs text-gray-700">
              {actualWeeklyHours.toFixed(1)}h / {expectedWeeklyHours.toFixed(1)}h ({workPercent}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className={`font-semibold ${
              isBalanced 
                ? 'text-green-600' 
                : isOverworking 
                  ? 'text-red-600' 
                  : 'text-yellow-600'
            }`}>
              {isBalanced && 'Within Expected Range'}
              {isOverworking && `${Math.abs(difference).toFixed(1)}h Over per Week`}
              {isUnderworking && `${difference.toFixed(1)}h Under per Week`}
            </span>
          </div>
        </div>
      </div>

      {/* Warning for Overworking */}
      {isOverworking && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-red-900">
              <p className="font-semibold mb-1">Warning: Exceeding Expected Hours</p>
              <p>
                You are scheduled for an average of {Math.abs(difference).toFixed(1)} hours more per week than your {workPercent}% position. 
                Consider reviewing your schedule to ensure compliance with working time regulations.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}