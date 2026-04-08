import { useMemo, useState } from 'react'
import { Calendar, dateFnsLocalizer, type EventProps } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { useProgramme } from '@/context'
import { formatDate, formatDateShort, cn } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import type { Session } from '@/types'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

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

interface RBCEvent {
  title: string
  start: Date
  end: Date
  resource?: Session
  roomId: string
  isSpecial: boolean
  sessionId?: string
}

function toDate(dateStr: string, timeStr: string): Date {
  const padded = timeStr.padStart(5, '0')
  return new Date(`${dateStr}T${padded}:00`)
}

// Custom event card rendered inside each calendar block
function EventCard({ event }: EventProps<RBCEvent>) {
  return (
    <div className="h-full overflow-hidden">
      {event.sessionId && (
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-75 leading-none mb-0.5">
          {event.sessionId}
        </p>
      )}
      <p className="text-xs font-semibold leading-snug line-clamp-3">{event.title}</p>
    </div>
  )
}

export default function TimetablePage() {
  const { data } = useProgramme()
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
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

  // All events across all days
  const allEvents = useMemo((): RBCEvent[] => {
    if (!data) return []
    return data.days.flatMap((day) =>
      day.events.map((e) => ({
        title: e.name,
        start: toDate(day.date, e.start),
        end: toDate(day.date, e.end),
        roomId: e.room_id,
        isSpecial: e.type === 'special',
        sessionId: e.type === 'session' ? e.session_id : undefined,
        resource: e.type === 'session' ? e : undefined,
      }))
    )
  }, [data])

  // Derive day boundaries from all events
  const { minTime, maxTime } = useMemo(() => {
    if (!data) return { minTime: new Date(0, 0, 0, 8, 0), maxTime: new Date(0, 0, 0, 20, 0) }
    const allEvts = data.days.flatMap((d) => d.events)
    const minH = Math.max(0, Math.min(...allEvts.map((e) => parseInt(e.start))) - 1)
    const maxH = Math.min(24, Math.max(...allEvts.map((e) => parseInt(e.end))) + 1)
    return { minTime: new Date(0, 0, 0, minH, 0), maxTime: new Date(0, 0, 0, maxH, 0) }
  }, [data])

  // Initialise to first conference day
  const activeDateObj = useMemo(() => {
    if (currentDate) return currentDate
    if (!data?.days[0]) return new Date()
    return new Date(data.days[0].date + 'T12:00:00')
  }, [currentDate, data])

  const conferenceDates = useMemo(
    () => data?.days.map((d) => new Date(d.date + 'T12:00:00')) ?? [],
    [data]
  )

  if (!data) return null

  return (
    <div>
      {/* Day navigation */}
      <div className="flex gap-0 border-b mb-4 overflow-x-auto">
        {data.days.map((day) => {
          const dayDate = new Date(day.date + 'T12:00:00')
          const isActive = activeDateObj.toDateString() === dayDate.toDateString()
          return (
            <button
              key={day.date}
              onClick={() => setCurrentDate(dayDate)}
              className={cn(
                'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              )}
            >
              {formatDateShort(day.date)}
            </button>
          )
        })}
      </div>

      <h2 className="text-lg font-semibold mb-3">
        {formatDate(activeDateObj.toISOString().slice(0, 10))}
      </h2>

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

      {/* Calendar */}
      <Calendar<RBCEvent>
        localizer={localizer}
        events={allEvents}
        defaultView="day"
        views={['day']}
        date={activeDateObj}
        onNavigate={(date) => {
          // Only allow navigation to actual conference days
          const match = conferenceDates.find((d) => d.toDateString() === date.toDateString())
          if (match) setCurrentDate(match)
        }}
        min={minTime}
        max={maxTime}
        step={15}
        timeslots={4}
        style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}
        eventPropGetter={(event) => {
          const idx = roomIndexMap.get(event.roomId) ?? 0
          const color = ROOM_COLORS[idx % ROOM_COLORS.length]
          return {
            style: {
              backgroundColor: event.isSpecial
                ? 'hsl(221.2 83.2% 53.3% / 0.15)'
                : color.main,
              color: event.isSpecial ? 'hsl(221.2 83.2% 35%)' : '#fff',
            },
          }
        }}
        components={{
          event: EventCard,
        }}
        onSelectEvent={(event) => {
          if (event.resource) setSelectedSession(event.resource)
        }}
        formats={{
          timeGutterFormat: (date, culture, loc) =>
            loc!.format(date, 'HH:mm', culture),
          eventTimeRangeFormat: () => '',
        }}
        popup
      />

      {/* Session detail slide-in */}
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
