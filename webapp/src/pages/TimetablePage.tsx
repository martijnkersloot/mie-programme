import { useMemo, useState } from 'react'
import { useNextCalendarApp, ScheduleXCalendar } from '@schedule-x/react'
import { createViewDay } from '@schedule-x/calendar'
import type { CalendarEvent } from '@schedule-x/calendar'
import { useProgramme } from '@/context'
import PresentationRow from '@/components/PresentationRow'
import type { Session } from '@/types'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const ROOM_COLORS = [
  { main: '#2563eb', container: '#dbeafe', onContainer: '#1e40af' },
  { main: '#0891b2', container: '#cffafe', onContainer: '#164e63' },
  { main: '#059669', container: '#d1fae5', onContainer: '#065f46' },
  { main: '#d97706', container: '#fef3c7', onContainer: '#92400e' },
  { main: '#dc2626', container: '#fee2e2', onContainer: '#991b1b' },
  { main: '#7c3aed', container: '#ede9fe', onContainer: '#4c1d95' },
  { main: '#db2777', container: '#fce7f3', onContainer: '#9d174d' },
  { main: '#ea580c', container: '#ffedd5', onContainer: '#9a3412' },
  { main: '#65a30d', container: '#ecfccb', onContainer: '#3f6212' },
]

function toZDT(date: string, time: string) {
  const padded = time.padStart(5, '0') // "8:30" → "08:30"
  return Temporal.ZonedDateTime.from(`${date}T${padded}:00[Europe/Amsterdam]`)
}

/** Replace every character that isn't alphanumeric or a hyphen with a hyphen */
function toSafeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9-]/g, '-')
}

export default function TimetablePage() {
  const { data } = useProgramme()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const roomIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    data?.rooms.forEach((r, i) => m.set(r.id, i))
    return m
  }, [data])

  const roomLabelMap = useMemo(() => {
    const m = new Map<string, string>()
    data?.rooms.forEach((r) => m.set(r.id, r.nickname || r.label))
    return m
  }, [data])

  const calendarsConfig = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(
      data.rooms.map((room) => {
        const idx = roomIndexMap.get(room.id) ?? 0
        const colors = ROOM_COLORS[idx % ROOM_COLORS.length]
        return [room.id, { colorName: room.id, lightColors: colors, darkColors: colors }]
      })
    )
  }, [data, roomIndexMap])

  const allEvents = useMemo((): CalendarEvent[] => {
    if (!data) return []
    return data.days.flatMap((day) =>
      day.events.map((e) => ({
        id: toSafeId(e.type === 'session' ? e.session_id : `special-${day.date}-${e.start}`),
        title: e.name,
        start: toZDT(day.date, e.start),
        end: toZDT(day.date, e.end),
        calendarId: e.room_id,
        // store session for click handler
        ...(e.type === 'session' ? { _session: e } : {}),
      }))
    )
  }, [data])

  const { slotMinTime, slotMaxTime } = useMemo(() => {
    if (!data) return { slotMinTime: '08:00', slotMaxTime: '20:00' }
    const allTimes = data.days.flatMap((d) => d.events)
    const minH = Math.max(0, Math.min(...allTimes.map((e) => parseInt(e.start))) - 1)
    const maxH = Math.min(24, Math.max(...allTimes.map((e) => parseInt(e.end))) + 1)
    return {
      slotMinTime: `${String(minH).padStart(2, '0')}:00`,
      slotMaxTime: `${String(maxH).padStart(2, '0')}:00`,
    }
  }, [data])

  const firstDate = data?.days[0]?.date
  const lastDate = data?.days[data.days.length - 1]?.date

  const calendar = useNextCalendarApp(
    {
      views: [createViewDay()],
      events: allEvents as unknown as CalendarEvent[],
      calendars: calendarsConfig,
      dayBoundaries: { start: slotMinTime, end: slotMaxTime },
      ...(firstDate
        ? {
            selectedDate: Temporal.PlainDate.from(firstDate),
            minDate: Temporal.PlainDate.from(firstDate),
            maxDate: Temporal.PlainDate.from(lastDate!),
          }
        : {}),
      callbacks: {
        onEventClick: (event) => {
          const session = (event as unknown as { _session?: Session })._session
          if (session) setSelectedSession(session)
        },
      },
    },
    []
  )

  if (!data) return null

  return (
    <div>
      {/* Room colour legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {data.rooms.map((room) => {
          const idx = roomIndexMap.get(room.id) ?? 0
          const color = ROOM_COLORS[idx % ROOM_COLORS.length]
          return (
            <span
              key={room.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: color.container, color: color.onContainer }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.main }} />
              {room.nickname || room.label}
            </span>
          )
        })}
      </div>

      <ScheduleXCalendar calendarApp={calendar} />

      {/* Session detail panel */}
      {selectedSession && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedSession(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col">
            <div className="flex items-start justify-between gap-4 p-5 border-b">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  {selectedSession.session_id} · {selectedSession.start}–{selectedSession.end}
                </p>
                <h3 className="text-base font-semibold leading-snug">{selectedSession.name}</h3>
                <Badge variant="outline" className="mt-2 text-xs">
                  {roomLabelMap.get(selectedSession.room_id) ?? selectedSession.room_id}
                </Badge>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-xs text-muted-foreground mb-3 font-medium">
                {selectedSession.presentations.length} presentation{selectedSession.presentations.length !== 1 ? 's' : ''}
              </p>
              {selectedSession.presentations.map((p) => (
                <PresentationRow key={p.id} presentation={p} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
