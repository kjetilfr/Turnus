// src/components/calendar/CalendarView.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import nbLocale from '@fullcalendar/core/locales/nb'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'
import { getNorwegianHolidays } from '@/lib/utils/norwegianHolidays'

interface CalendarViewProps {
  rotations: Rotation[]
  shifts: Shift[]
  planStartDate: string
  durationWeeks: number
  planType: 'main' | 'helping' | 'year'  // ADD THIS LINE
}

function getRotationDate(planStartDate: Date, weekIndex: number, dayOfWeek: number): Date {
  const d = new Date(planStartDate)
  const jsDay = d.getDay()
  const mondayFirstIndex = (jsDay + 6) % 7
  d.setDate(d.getDate() - mondayFirstIndex)
  d.setDate(d.getDate() + weekIndex * 7 + dayOfWeek)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateLocal(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
}

export default function CalendarView({ 
  rotations, 
  shifts, 
  planStartDate,
  durationWeeks,
  planType
}: CalendarViewProps) {
  const calendarRef = useRef<HTMLDivElement>(null)
  const calendarInstance = useRef<Calendar | null>(null)
  const [currentView, setCurrentView] = useState<'month' | 'week'>('month')
  const [repeatCount, setRepeatCount] = useState(1)

  useEffect(() => {
    if (!calendarRef.current) return

    // Create a map of shifts for quick lookup
    const shiftsMap = new Map(shifts.map(shift => [shift.id, shift]))
    

    // Get Norwegian holidays for relevant years
    const startYear = new Date(planStartDate).getFullYear()
    const endYear = new Date(planStartDate)
    const totalDisplayWeeks = durationWeeks * repeatCount
    endYear.setDate(endYear.getDate() + (totalDisplayWeeks * 7))
    const finalYear = endYear.getFullYear()
    
    let holidays: Array<{date: string, name: string, localName: string}> = []
    for (let year = startYear; year <= finalYear; year++) {
      holidays = holidays.concat(getNorwegianHolidays(year))
    }

    // Convert holidays to calendar events
    const holidayEvents = holidays.map(holiday => ({
      id: `holiday-${holiday.date}`,
      title: `🇳🇴 ${holiday.localName}`,
      start: holiday.date,
      allDay: true,
      backgroundColor: '#EF4444', // Red for holidays
      borderColor: '#DC2626',
      display: 'background',
      extendedProps: {
        isHoliday: true,
        holidayName: holiday.name,
        localName: holiday.localName
      }
    }))

    const repeatedRotations: Rotation[] = []
    for (let repeat = 0; repeat < repeatCount; repeat++) {
      rotations.forEach(rotation => {
        repeatedRotations.push({
          ...rotation,
          week_index: rotation.week_index + (repeat * durationWeeks)
        })
      })
    }

    // Convert rotations to calendar events
    const events = repeatedRotations
      .filter(rotation => rotation.shift_id)
      .map(rotation => {
        const originalShift = rotation.shift_id ? shiftsMap.get(rotation.shift_id) : null
        const overlayShift = rotation.overlay_shift_id ? shiftsMap.get(rotation.overlay_shift_id) : null
        const effectiveShift = overlayShift || originalShift
        if (!effectiveShift) return null

        // Calculate the actual date for this rotation
        const startDate = new Date(planStartDate)
        const daysToAdd = rotation.week_index * 7 + rotation.day_of_week
        startDate.setDate(startDate.getDate() + daysToAdd)

        const dateString = formatDateLocal(startDate)

        // Determine event color based on shift type
        const color = effectiveShift.is_default 
          ? '#6B7280' // gray for default shifts
          : '#4F46E5' // indigo for custom shifts

        // For shifts with time, create timed events
        if (effectiveShift.start_time && effectiveShift.end_time) {
          const [startHour, startMin] = effectiveShift.start_time.split(':').map(Number)
          const [endHour, endMin] = effectiveShift.end_time.split(':').map(Number)
          
          const startMinutes = startHour * 60 + startMin
          const endMinutes = endHour * 60 + endMin
          
          // Check if shift crosses midnight
          const crossesMidnight = endMinutes < startMinutes
          
          // For night shifts that cross midnight, we need to start them on the PREVIOUS day
          // because the rotation grid shows them on the day they have most hours (after midnight)
          let actualStartDate = dateString
          let actualEndDate = dateString
          
          if (crossesMidnight) {
            // Night shift crosses midnight
            // Grid shows it on the day with most hours (the day AFTER it starts)
            // So we need to subtract one day to get the actual start date
            const startDate = new Date(dateString)
            startDate.setDate(startDate.getDate() - 1)
            actualStartDate = startDate.toISOString().split('T')[0]
            actualEndDate = dateString // Ends on the day shown in grid
          }

          return {
            id: `${rotation.id}-repeat-${Math.floor(rotation.week_index / durationWeeks)}`,
            title: effectiveShift.name,
            start: `${actualStartDate}T${effectiveShift.start_time}`,
            end: `${actualEndDate}T${effectiveShift.end_time}`,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
              shiftId: effectiveShift.id,
              shiftName: effectiveShift.name,
              description: effectiveShift.description,
              notes: rotation.notes,
              repeatCycle: Math.floor(rotation.week_index / durationWeeks)
            }
          }
        }

        let title = effectiveShift.name
        if (overlayShift && originalShift) {
          title = `(${originalShift.name}) ${overlayShift.name}`
        }

        // For default shifts without time, create all-day events
        return {
          id: rotation.id,
          title: title,
          start: dateString,
          backgroundColor: color,
          borderColor: overlayShift ? '#000' : color,
          borderStyle: overlayShift ? 'dashed' : 'solid',
          extendedProps: {
            hasOverlay: !!overlayShift,
            originalShiftName: originalShift?.name,
            overlayType: rotation.overlay_type
          }
        }
      })
      .filter(event => event !== null)

    // Combine shift events and holiday events
    const allEvents = [...holidayEvents, ...events]

    // Initialize FullCalendar
    const calendar = new Calendar(calendarRef.current, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      initialDate: planStartDate,
      locale: nbLocale,
      firstDay: 1, // Monday
      weekNumbers: true, // Show week numbers
      weekText: 'Uke ', // Norwegian for "Week"
      buttonText: {
        today: 'I dag',
        month: 'Måned',
        week: 'Uke',
        day: 'Dag'
      },
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek'
      },
      events: allEvents,
      editable: false,
      selectable: false,
      displayEventTime: true,
      displayEventEnd: true,
      eventTimeFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      },
      views: {
        dayGridMonth: {
          titleFormat: { year: 'numeric', month: 'long' },
          dayMaxEvents: false, // Show all events
          moreLinkClick: 'popover',
          eventDisplay: 'block' // Force block display for all events
        },
        timeGridWeek: {
          titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
          slotMinTime: '06:00:00',
          slotMaxTime: '24:00:00'
        }
      },
      eventClick: (info) => {
        // Show event details in alert (you can customize this)
        const props = info.event.extendedProps
        
        if (props.isHoliday) {
          alert(`🇳🇴 ${props.localName}\n(${props.holidayName})`)
          return
        }
        
        let message = `Shift: ${info.event.title}\n`
        if (props.description) {
          message += `Description: ${props.description}\n`
        }
        if (props.notes) {
          message += `Notes: ${props.notes}\n`
        }
        if (!info.event.allDay) {
          message += `Time: ${info.event.start?.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - ${info.event.end?.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`
        }
        alert(message)
      },
      eventContent: (arg) => {
        // Custom event rendering
        const timeText = arg.timeText || ''
        return {
          html: `
            <div class="fc-event-main-frame">
              <div class="fc-event-time">${timeText}</div>
              <div class="fc-event-title-container">
                <div class="fc-event-title fc-sticky font-semibold">
                  ${arg.event.title}
                </div>
              </div>
            </div>
          `
        }
      },
      dayCellDidMount: (info) => {
        // Add rotation week number below the week number
        const date = info.date
        const planStart = new Date(planStartDate)
        
        // Align to Monday (same logic as rotation grid)
        const jsDay = planStart.getDay()
        const mondayFirstIndex = (jsDay + 6) % 7
        const alignedPlanStart = new Date(planStart)
        alignedPlanStart.setDate(alignedPlanStart.getDate() - mondayFirstIndex)
        alignedPlanStart.setHours(0, 0, 0, 0)
        
        // Calculate days difference from aligned Monday
        const diffTime = date.getTime() - alignedPlanStart.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        
        // Calculate rotation week (0-indexed)
        const rotationWeek = Math.floor(diffDays / 7)
        
        // Only show if within the plan duration and not negative
        if (rotationWeek >= 0 && rotationWeek < totalDisplayWeeks) {  // CHANGE from durationWeeks
          const weekCell = info.el.closest('tr')?.querySelector('.fc-daygrid-week-number')
          if (weekCell && !weekCell.querySelector('.rotation-week')) {
            const rotationWeekSpan = document.createElement('div')
            rotationWeekSpan.className = 'rotation-week'
            rotationWeekSpan.style.cssText = 'font-size: 0.7em; color: #6366F1; font-weight: 600; margin-top: 2px;'
            
            const weekInCycle = (rotationWeek % durationWeeks) + 1
            rotationWeekSpan.textContent = `(T${weekInCycle})`
            weekCell.appendChild(rotationWeekSpan)
          }
        }
      },
      height: 'auto',
      aspectRatio: 1.8
    })

    calendar.render()
    calendarInstance.current = calendar

    return () => {
      calendar.destroy()
    }
  }, [rotations, shifts, planStartDate, durationWeeks, repeatCount])

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Shift Calendar</h2>
          <p className="text-sm text-gray-600">
            View your rotation schedule in calendar format. Click on any shift to see details.
          </p>
        </div>
        
        {planType === 'main' && (
          <div className="flex items-center gap-3">
            <label htmlFor="repeatCount" className="text-sm font-medium text-gray-700">
              Repeat rotation:
            </label>
            <select
              id="repeatCount"
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'time' : 'times'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="calendar-container" ref={calendarRef}></div>

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Legend</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-600"></div>
            <span className="text-sm text-gray-700">Default Shifts (F1-F5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-indigo-600"></div>
            <span className="text-sm text-gray-700">Custom Shifts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-sm text-gray-700">🇳🇴 Norwegian Holidays</span>
          </div>
        </div>
        {planType === 'main' && repeatCount > 1 && (
          <div className="mt-3 text-sm text-gray-600">
            <strong>Note:</strong> Rotation repeated {repeatCount} times. Week labels restart at T1 for each cycle.
          </div>
        )}
      </div>

      {/* FullCalendar Styles */}
      <style jsx global>{`
        .fc {
          font-family: inherit;
        }
        
        .fc .fc-button {
          background-color: #4F46E5;
          border-color: #4F46E5;
          text-transform: capitalize;
          padding: 0.5rem 1rem;
          font-weight: 600;
        }
        
        .fc .fc-button:hover {
          background-color: #4338CA;
          border-color: #4338CA;
        }
        
        .fc .fc-button-primary:disabled {
          background-color: #9CA3AF;
          border-color: #9CA3AF;
        }
        
        .fc-theme-standard td,
        .fc-theme-standard th {
          border-color: #E5E7EB;
        }
        
        .fc-theme-standard .fc-scrollgrid {
          border-color: #E5E7EB;
        }
        
        .fc .fc-col-header-cell {
          background-color: #F9FAFB;
          padding: 0.75rem 0.5rem;
          font-weight: 600;
          color: #374151;
        }
        
        .fc .fc-daygrid-day-number {
          padding: 0.5rem;
          color: #1F2937;
          font-weight: 500;
        }
        
        .fc .fc-daygrid-day.fc-day-today {
          background-color: #EEF2FF;
        }
        
        .fc .fc-event {
          cursor: pointer;
          margin: 2px;
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 0.875rem;
        }
        
        .fc .fc-event:hover {
          opacity: 0.85;
        }
        
        .fc-direction-ltr .fc-daygrid-event {
          margin-left: 2px;
          margin-right: 2px;
          background-color: #4F46E5;
        }

        .fc-timegrid-event {
          border-radius: 4px;
        }

        .fc-v-event .fc-event-main {
          color: white;
        }

        .fc-day-sun .fc-daygrid-day-number {
            color: #DC2626;
            font-weight: 600;
        }

        .fc-timegrid-axis-cushion, .fc-timegrid-slot-label-cushion {
            color: black;
        }

        /* Ensure colors work in month view */
        .fc-daygrid-event {
          white-space: normal;
        }

        .fc-daygrid-event .fc-event-main {
          color: white;
        }

        .fc-daygrid-dot-event .fc-event-title {
          font-weight: 600;
        }

        /* Ensure block events show colors */
        .fc-daygrid-block-event .fc-event-main {
          padding: 2px 4px;
        }

        /* Style for holiday backgrounds */
        .fc-bg-event {
          opacity: 0.15;
        }

        .fc-day.fc-day-today {
          background-color: #EEF2FF !important;
        }

        /* Style week numbers */
        .fc-daygrid-week-number {
          background-color: #F3F4F6;
          color: #374151;
          font-weight: 600;
          padding: 4px 8px;
          text-align: center;
          min-width: 60px;
        }

        .fc-toolbar-title {
            color: #000000;
        }

        .fc-daygrid-week-number a {
          color: inherit;
          text-decoration: none;
        }
      `}</style>
    </div>
  )
}