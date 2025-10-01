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

interface CalendarViewProps {
  rotations: Rotation[]
  shifts: Shift[]
  planStartDate: string // Format: YYYY-MM-DD
  durationWeeks: number
}

export default function CalendarView({ 
  rotations, 
  shifts, 
  planStartDate,
  durationWeeks 
}: CalendarViewProps) {
  const calendarRef = useRef<HTMLDivElement>(null)
  const calendarInstance = useRef<Calendar | null>(null)
  const [currentView, setCurrentView] = useState<'month' | 'week'>('month')

  useEffect(() => {
    if (!calendarRef.current) return

    // Create a map of shifts for quick lookup
    const shiftsMap = new Map(shifts.map(shift => [shift.id, shift]))

    // Convert rotations to calendar events
    const events = rotations
      .filter(rotation => rotation.shift_id)
      .map(rotation => {
        const shift = shiftsMap.get(rotation.shift_id!)
        if (!shift) return null

        // Calculate the actual date for this rotation
        const startDate = new Date(planStartDate)
        const daysToAdd = rotation.week_index * 7 + rotation.day_of_week
        startDate.setDate(startDate.getDate() + daysToAdd)

        const dateString = startDate.toISOString().split('T')[0]

        // Determine event color based on shift type
        const color = shift.is_default 
          ? '#6B7280' // gray for default shifts
          : '#4F46E5' // indigo for custom shifts

        // For shifts with time, create timed events
        if (shift.start_time && shift.end_time) {
          const [startHour, startMin] = shift.start_time.split(':').map(Number)
          const [endHour, endMin] = shift.end_time.split(':').map(Number)
          
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
            id: rotation.id,
            title: shift.name,
            start: `${actualStartDate}T${shift.start_time}`,
            end: `${actualEndDate}T${shift.end_time}`,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
              shiftId: shift.id,
              shiftName: shift.name,
              description: shift.description,
              notes: rotation.notes
            }
          }
        }

        // For default shifts without time, create all-day events
        return {
          id: rotation.id,
          title: shift.name,
          start: dateString,
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          extendedProps: {
            shiftId: shift.id,
            shiftName: shift.name,
            description: shift.description,
            notes: rotation.notes
          }
        }
      })
      .filter(event => event !== null)

    // Initialize FullCalendar
    const calendar = new Calendar(calendarRef.current, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      initialDate: planStartDate,
      locale: nbLocale,
      firstDay: 1, // Monday
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
      events: events,
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
      height: 'auto',
      aspectRatio: 1.8
    })

    calendar.render()
    calendarInstance.current = calendar

    return () => {
      calendar.destroy()
    }
  }, [rotations, shifts, planStartDate])

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Shift Calendar</h2>
        <p className="text-sm text-gray-600">
          View your rotation schedule in calendar format. Click on any shift to see details.
        </p>
      </div>
      
      <div className="calendar-container" ref={calendarRef}></div>

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Legend</h3>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-600"></div>
            <span className="text-sm text-gray-700">Default Shifts (F1-F5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-indigo-600"></div>
            <span className="text-sm text-gray-700">Custom Shifts</span>
          </div>
        </div>
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
          font-weight: 700;
        }

        .fc-timegrid-event {
          border-radius: 4px;
        }

        .fc-v-event .fc-event-main {
          color: white;
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

        .fc-toolbar-title {
            color: #000000;
        }

        /* Ensure block events show colors */
        .fc-daygrid-block-event .fc-event-main {
          padding: 2px 4px;
        }
      `}</style>
    </div>
  )
}