// src/components/plan/FullCalendarView.tsx
'use client'

import { useEffect, useRef } from 'react'
import { Calendar } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import nbLocale from '@fullcalendar/core/locales/nb'
import { getNorwegianHolidays, getHolidaysInRange, isNorwegianHoliday, formatNorwegianDate, type NorwegianHoliday } from '@/lib/norwegian-holidays'
import type { Plan, Shift, Rotation } from '@/types/scheduler'

interface FullCalendarViewProps {
  plan: Plan
  shifts: Shift[]
  rotations: Rotation[]
  startDate: Date
}

// Helper function to check if a shift is an F shift (F1-F5)
function isFShift(shift: Shift): boolean {
  return /^f[1-5]$/i.test(shift.name.trim())
}

// Helper to format time for display
function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

export default function FullCalendarView({ 
  plan, 
  shifts, 
  rotations, 
  startDate 
}: FullCalendarViewProps) {
  const calendarRef = useRef<HTMLDivElement>(null)
  const calendarInstance = useRef<Calendar | null>(null)

  useEffect(() => {
    if (!calendarRef.current) return

    // Calculate plan end date
    const planEndDate = new Date(startDate)
    planEndDate.setDate(startDate.getDate() + (plan.duration_weeks * 7) - 1)

    // Get Norwegian holidays in the plan period
    const holidays = getHolidaysInRange(startDate, planEndDate)

    // Convert holidays to FullCalendar events
    const holidayEvents = holidays.map(holiday => ({
      id: `holiday-${holiday.date.getTime()}`,
      title: holiday.name,
      start: holiday.date.toISOString().split('T')[0],
      allDay: true,
      backgroundColor: '#DC2626', // Red background
      borderColor: '#B91C1C',
      textColor: '#ffffff',
      display: 'background', // Background event
      extendedProps: {
        type: 'holiday',
        holiday: holiday
      }
    }))

    // Convert rotations to FullCalendar events
    const shiftEvents = rotations
      .filter(rotation => rotation.shift_id && rotation.shift)
      .map(rotation => {
        const shift = rotation.shift!
        
        // Calculate the actual date for this rotation
        const eventDate = new Date(startDate)
        eventDate.setDate(startDate.getDate() + (rotation.week_index * 7) + rotation.day_of_week)
        
        const isShiftFShift = isFShift(shift)
        
        if (isShiftFShift) {
          // F shifts - all day events since times don't matter
          return {
            id: `shift-${rotation.id}`,
            title: shift.name,
            start: eventDate.toISOString().split('T')[0], // Just the date part
            allDay: true,
            backgroundColor: shift.color,
            borderColor: shift.color,
            textColor: '#ffffff',
            extendedProps: {
              type: 'shift',
              shiftType: 'F',
              rotation: rotation,
              shift: shift
            }
          }
        } else {
          // Regular shifts with specific times
          const startDateTime = new Date(eventDate)
          const endDateTime = new Date(eventDate)
          
          const [startHours, startMinutes] = shift.start_time.split(':').map(Number)
          const [endHours, endMinutes] = shift.end_time.split(':').map(Number)
          
          startDateTime.setHours(startHours, startMinutes, 0, 0)
          endDateTime.setHours(endHours, endMinutes, 0, 0)
          
          // Handle overnight shifts
          if (shift.start_time > shift.end_time) {
            endDateTime.setDate(endDateTime.getDate() + 1)
          }
          
          return {
            id: `shift-${rotation.id}`,
            title: `${shift.name} (${formatTime(shift.start_time)}-${formatTime(shift.end_time)})`,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            backgroundColor: shift.color,
            borderColor: shift.color,
            textColor: '#ffffff',
            extendedProps: {
              type: 'shift',
              shiftType: 'regular',
              rotation: rotation,
              shift: shift
            }
          }
        }
      })

    // Combine holiday and shift events
    const allEvents = [...holidayEvents, ...shiftEvents]

    // Initialize FullCalendar
    const calendar = new Calendar(calendarRef.current, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      locale: nbLocale, // Norwegian localization
      initialView: 'dayGridMonth',
      initialDate: startDate,
      events: allEvents,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      buttonText: {
        today: 'I dag',
        month: 'Måned',
        week: 'Uke',
        day: 'Dag'
      },
      firstDay: 1, // Start week on Monday (Norwegian standard)
      weekNumbers: true, // Show week numbers (common in Norway)
      weekText: 'Uke',
      height: 'auto',
      aspectRatio: 1.5,
      eventDisplay: 'block',
      dayMaxEvents: false, // Show all events
      eventTextColor: '#ffffff',
      
      // Customize event rendering
      eventDidMount: (info) => {
        const eventType = info.event.extendedProps.type
        
        if (eventType === 'holiday') {
          const holiday = info.event.extendedProps.holiday as NorwegianHoliday
          info.el.title = `Helligdag: ${holiday.name}`
          info.el.style.fontSize = '0.75rem'
          info.el.style.fontWeight = 'bold'
        } else if (eventType === 'shift') {
          const shift = info.event.extendedProps.shift
          const isShiftFShift = info.event.extendedProps.shiftType === 'F'
          
          // Add tooltip with shift details
          const tooltipText = isShiftFShift 
            ? `F-vakt: ${shift.name} - Kun plassering viktig`
            : `${shift.name}\n${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`
          
          info.el.title = tooltipText
          
          // Add special styling for F shifts
          if (isShiftFShift) {
            info.el.style.border = '2px dashed rgba(255,255,255,0.5)'
            info.el.style.fontWeight = 'bold'
          }
        }
      },
      
      // Handle view changes to highlight plan duration
      viewDidMount: (info) => {
        // Calculate plan end date
        const planEndDate = new Date(startDate)
        planEndDate.setDate(startDate.getDate() + (plan.duration_weeks * 7) - 1)
        
        // Add visual indicators for plan boundaries if needed
        // This could be enhanced to highlight the plan period
      },
      
      // Add custom styling based on day type
      dayCellDidMount: (info) => {
        const cellDate = info.date
        const planEndDate = new Date(startDate)
        planEndDate.setDate(startDate.getDate() + (plan.duration_weeks * 7) - 1)
        
        // Check if this date is a Norwegian holiday
        const holiday = isNorwegianHoliday(cellDate)
        
        if (holiday) {
          // Mark holidays in red (stronger red for the cell)
          info.el.style.backgroundColor = 'rgba(220, 38, 38, 0.15)'
          info.el.style.color = '#B91C1C'
          info.el.classList.add('norwegian-holiday')
          
          // Add holiday name to the day number
          const dayNumber = info.el.querySelector('.fc-daygrid-day-number') as HTMLElement
          if (dayNumber) {
            dayNumber.setAttribute('title', `Helligdag: ${holiday.name}`)
            dayNumber.style.fontWeight = 'bold'
            dayNumber.style.color = '#B91C1C'
          }
        } else {
          // Highlight days within the plan period (but not holidays)
          if (cellDate >= startDate && cellDate <= planEndDate) {
            info.el.style.backgroundColor = 'rgba(59, 130, 246, 0.05)'
          }
          
          // Special styling for Sundays (F3 days typically) - but not if it's already a holiday
          if (cellDate.getDay() === 0) {
            info.el.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'
            const dayNumber = info.el.querySelector('.fc-daygrid-day-number') as HTMLElement
            if (dayNumber && !holiday) {
              dayNumber.style.color = '#DC2626'
              dayNumber.style.fontWeight = '600'
            }
          }
        }
      }
    })

    calendar.render()
    calendarInstance.current = calendar

    return () => {
      if (calendarInstance.current) {
        calendarInstance.current.destroy()
        calendarInstance.current = null
      }
    }
  }, [plan, shifts, rotations, startDate])

  // Calculate statistics including holidays
  const planEndDate = new Date(startDate)
  planEndDate.setDate(startDate.getDate() + (plan.duration_weeks * 7) - 1)
  const holidaysInPlan = getHolidaysInRange(startDate, planEndDate)

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {plan.name} - Kalendervisning
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {startDate.toLocaleDateString('nb-NO')} - {' '}
            {planEndDate.toLocaleDateString('nb-NO')}
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {plan.duration_weeks} ukers turnus-plan med norske helligdager
        </p>
      </div>
      
      <div className="p-6">
        {/* Legend */}
        <div className="mb-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-dashed border-blue-400 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Plan periode</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-200 border border-red-400 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Norske helligdager</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-100 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Søndager</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 border-2 border-dashed border-white rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">F-vakter</span>
          </div>
        </div>
        
        {/* Holidays in Plan Period */}
        {holidaysInPlan.length > 0 && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
              Helligdager i planperioden:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {holidaysInPlan.map((holiday, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-800 dark:text-red-300">
                    {holiday.date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} - {holiday.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Calendar Container */}
        <div ref={calendarRef} className="fullcalendar-container" />
        
        {/* Statistics */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {rotations.filter(r => r.shift_id).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Totale vakter</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {rotations.filter(r => r.shift && isFShift(r.shift)).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">F-vakter</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              {holidaysInPlan.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Helligdager</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {plan.duration_weeks}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Uker</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
              {(plan.duration_weeks * 7) - rotations.filter(r => r.shift_id).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Fridager</div>
          </div>
        </div>
      </div>
      
      {/* Calendar styles */}
      <style jsx global>{`
        .fullcalendar-container .fc-theme-standard .fc-scrollgrid {
          border: 1px solid #e5e7eb;
        }
        
        .dark .fullcalendar-container .fc-theme-standard .fc-scrollgrid {
          border: 1px solid #374151;
        }
        
        .fullcalendar-container .fc-col-header-cell {
          background-color: #f9fafb;
          font-weight: 600;
        }
        
        .dark .fullcalendar-container .fc-col-header-cell {
          background-color: #1f2937;
          color: #f9fafb;
        }
        
        .fullcalendar-container .fc-daygrid-day {
          background-color: #ffffff;
        }
        
        .dark .fullcalendar-container .fc-daygrid-day {
          background-color: #1f2937;
        }
        
        .fullcalendar-container .fc-day-today {
          background-color: #fef3c7 !important;
        }
        
        .dark .fullcalendar-container .fc-day-today {
          background-color: #451a03 !important;
        }
        
        /* Norwegian holiday styling */
        .fullcalendar-container .norwegian-holiday {
          font-weight: bold;
        }
        
        .fullcalendar-container .norwegian-holiday .fc-daygrid-day-number {
          color: #B91C1C !important;
          font-weight: bold !important;
        }
        
        .dark .fullcalendar-container .norwegian-holiday .fc-daygrid-day-number {
          color: #F87171 !important;
        }
        
        .fullcalendar-container .fc-event {
          border-radius: 4px;
          margin: 1px 2px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        
        /* Holiday background events */
        .fullcalendar-container .fc-event[data-type="holiday"] {
          opacity: 0.3;
        }
        
        .fullcalendar-container .fc-button {
          background-color: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }
        
        .fullcalendar-container .fc-button:hover {
          background-color: #2563eb;
          border-color: #2563eb;
        }
        
        .fullcalendar-container .fc-button:disabled {
          background-color: #9ca3af;
          border-color: #9ca3af;
        }
        
        .dark .fullcalendar-container .fc-toolbar-title,
        .dark .fullcalendar-container .fc-col-header-cell-cushion,
        .dark .fullcalendar-container .fc-daygrid-day-number {
          color: #f9fafb;
        }
        
        .fullcalendar-container .fc-daygrid-week-number {
          color: #6b7280;
          font-weight: 600;
        }
        
        .dark .fullcalendar-container .fc-daygrid-week-number {
          color: #9ca3af;
        }
        
        /* Sunday styling (red text for traditional Norwegian calendar look) */
        .fullcalendar-container .fc-day-sun .fc-daygrid-day-number {
          color: #DC2626;
          font-weight: 600;
        }
        
        .dark .fullcalendar-container .fc-day-sun .fc-daygrid-day-number {
          color: #F87171;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}