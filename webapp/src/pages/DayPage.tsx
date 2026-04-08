import { useMemo, useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react'
import { createViewDay } from '@schedule-x/calendar'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import type { Session } from '@/types'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Distinct colours per room (index-based)
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

interface CalendarEventWithSession {
  id: string
  title: string
  start: Temporal.ZonedDateTime
  end: Temporal.ZonedDateTime
  calendarId: string
  _session?: Session
  _isSpecial?: boolean
}

// Inner component so useCalendarApp gets a fresh instance per date
function DayCalendar({
  date,
  events,
  calendarsConfig,
  slotMinTime,
  slotMaxTime,
  onSessionClick,
  onNavigate,
}: {
  date: string
  events: CalendarEventWithSession[]
  calendarsConfig: Record<string, { colorName: string; lightColors: { main: string; container: string; onContainer: string } }>
  slotMinTime: string
  slotMaxTime: string
  onSessionClick: (session: Session) => void
  onNavigate: (date: string) => void
}) {
  const calendar = useCalendarApp({
    views: [createViewDay()],
    selectedDate: Temporal.PlainDate.from(date),
    dayBoundaries: { start: slotMinTime, end: slotMaxTime },
    events,
    calendars: calendarsConfig,
    callbacks: {
      onEventClick: (event) => {
        const e = event as unknown as CalendarEventWithSession
        if (e._session) onSessionClick(e._session)
      },
      onRangeUpdate: (range) => {
        // Sync schedule-x prev/next navigation back to router
        const newDate = (range.start as unknown as Temporal.ZonedDateTime).toPlainDate().toString()
        if (newDate !== date) onNavigate(newDate)
      },
    },
  })

  return (
    <div className="rounded-lg border overflow-hidden">
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  )
}

export default function DayPage() {
  const { date } = useParams<{ date: string }>()
  const { data } = useProgramme()
  const navigate = useNavigate()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const day = useMemo(() => data?.days.find((d) => d.date === date), [data, date])

  // Build room lookup: id → index (for colours)
  const roomIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    data?.rooms.forEach((r, i) => m.set(r.id, i))
    return m
  }, [data])

  // Room lookup: id → label/nickname
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
        return [
          room.id,
          { colorName: room.id, lightColors: colors, darkColors: colors },
        ]
      })
    )
  }, [data, roomIndexMap])

  const calendarEvents = useMemo((): CalendarEventWithSession[] => {
    if (!day || !date) return []
    const toZDT = (dateStr: string, timeStr: string) =>
      Temporal.ZonedDateTime.from(`${dateStr}T${timeStr}:00[Europe/Amsterdam]`)
    return day.events.map((e) => {
      const base = {
        id: e.type === 'session' ? e.session_id : `special-${e.start}`,
        title: e.name,
        start: toZDT(date, e.start),
        end: toZDT(date, e.end),
        calendarId: e.room_id,
      }
      if (e.type === 'session') {
        return { ...base, _session: e }
      }
      return { ...base, _isSpecial: true }
    })
  }, [day, date])

  const { slotMinTime, slotMaxTime } = useMemo(() => {
    if (!day) return { slotMinTime: '08:00', slotMaxTime: '20:00' }
    const starts = day.events.map((e) => parseInt(e.start))
    const ends = day.events.map((e) => parseInt(e.end))
    const minH = Math.max(0, Math.min(...starts) - 1)
    const maxH = Math.min(24, Math.max(...ends) + 1)
    return {
      slotMinTime: `${String(minH).padStart(2, '0')}:00`,
      slotMaxTime: `${String(maxH).padStart(2, '0')}:00`,
    }
  }, [day])

  if (!data) return null
  if (!day) return <Navigate to={`/day/${data.days[0]?.date}`} replace />

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{formatDate(day.date)}</h2>

      {/* Room legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {data.rooms.filter((r) => r.id !== 'other' || day.events.some((e) => e.room_id === 'other')).map((room) => {
          const idx = roomIndexMap.get(room.id) ?? 0
          const color = ROOM_COLORS[idx % ROOM_COLORS.length]
          return (
            <span
              key={room.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: color.container, color: color.onContainer }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: color.main }}
              />
              {room.nickname || room.label}
            </span>
          )
        })}
      </div>

      {/* Calendar — key forces remount when date changes */}
      <DayCalendar
        key={date}
        date={date!}
        events={calendarEvents}
        calendarsConfig={calendarsConfig}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        onSessionClick={setSelectedSession}
        onNavigate={(d) => navigate(`/day/${d}`)}
      />

      {/* Session detail slide-in panel */}
      {selectedSession && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedSession(null)}
          />
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
