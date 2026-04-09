import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer, type EventProps } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import type { Session } from '@/types'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

const ROOM_COLORS = [
  '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#ea580c', '#65a30d',
]

interface RBCEvent {
  title: string
  start: Date
  end: Date
  session?: Session
  roomId: string
  isSpecial: boolean
  sessionId?: string
}

interface RBCResource {
  id: string
  title: string
}

function toDate(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr.padStart(5, '0')}:00`)
}

function EventCard({ event }: EventProps<RBCEvent>) {
  return (
    <div className="h-full overflow-hidden leading-tight">
      {event.sessionId && (
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 leading-none mb-0.5">
          {event.sessionId}
        </p>
      )}
      <p className="text-xs font-semibold line-clamp-3">{event.title}</p>
    </div>
  )
}

export default function TimetablePage() {
  const { data } = useProgramme()
  const { date: dateParam } = useParams<{ date?: string }>()
  const navigate = useNavigate()
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

  const resources = useMemo((): RBCResource[] =>
    data?.rooms.map((r) => ({ id: r.id, title: r.nickname || r.label || r.id })) ?? [],
    [data]
  )

  const allEvents = useMemo((): RBCEvent[] => {
    if (!data) return []
    return data.days.flatMap((day) =>
      day.events
        .filter((e) => e.start && e.end && e.room_id)
        .map((e) => ({
          title: e.name,
          start: toDate(day.date, e.start),
          end: toDate(day.date, e.end),
          roomId: e.room_id,
          isSpecial: e.type === 'special',
          sessionId: e.type === 'session' ? e.session_id : undefined,
          session: e.type === 'session' ? e : undefined,
        }))
    )
  }, [data])

  const conferenceDates = useMemo(
    () => data?.days.map((d) => new Date(d.date + 'T12:00:00')) ?? [],
    [data]
  )

  const activeDateObj = useMemo(() => {
    if (dateParam) {
      const match = conferenceDates.find((d) => d.toISOString().slice(0, 10) === dateParam)
      if (match) return match
    }
    return conferenceDates[0] ?? new Date()
  }, [dateParam, conferenceDates])

  const activeIdx = useMemo(
    () => conferenceDates.findIndex((d) => d.toDateString() === activeDateObj.toDateString()),
    [conferenceDates, activeDateObj]
  )

  const { minTime, maxTime } = useMemo(() => {
    const dayEvts = data?.days
      .find((d) => new Date(d.date + 'T12:00:00').toDateString() === activeDateObj.toDateString())
      ?.events.filter((e) => e.start && e.end) ?? []
    if (dayEvts.length === 0) return { minTime: new Date(0, 0, 0, 8, 0), maxTime: new Date(0, 0, 0, 20, 0) }
    const minH = Math.max(0, Math.min(...dayEvts.map((e) => parseInt(e.start))) - 1)
    const maxH = Math.min(24, Math.max(...dayEvts.map((e) => parseInt(e.end))) + 1)
    return { minTime: new Date(0, 0, 0, minH, 0), maxTime: new Date(0, 0, 0, maxH, 0) }
  }, [data, activeDateObj])

  const goToDay = (date: Date) => navigate(`/timetable/${date.toISOString().slice(0, 10)}`)

  if (!data) return null

  return (
    <div>
      {/* Date heading + prev/next buttons */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {formatDate(activeDateObj.toISOString().slice(0, 10))}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToDay(conferenceDates[activeIdx - 1])}
            disabled={activeIdx <= 0}
            className="p-1.5 rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToDay(conferenceDates[activeIdx + 1])}
            disabled={activeIdx >= conferenceDates.length - 1}
            className="p-1.5 rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar */}
      <Calendar<RBCEvent, RBCResource>
        localizer={localizer}
        events={allEvents}
        defaultView="day"
        views={['day']}
        date={activeDateObj}
        onNavigate={(date) => {
          const match = conferenceDates.find((d) => d.toDateString() === date.toDateString())
          if (match) goToDay(match)
        }}
        resources={resources}
        resourceIdAccessor="id"
        resourceTitleAccessor="title"
        resourceAccessor="roomId"
        min={minTime}
        max={maxTime}
        step={30}
        timeslots={2}
        style={{ height: 'calc(100vh - 240px)', minHeight: 500 }}
        eventPropGetter={(event) => {
          const idx = roomIndexMap.get(event.roomId) ?? 0
          const color = ROOM_COLORS[idx % ROOM_COLORS.length]
          return {
            style: {
              backgroundColor: event.isSpecial ? 'hsl(221.2 83.2% 53.3% / 0.15)' : color,
              color: event.isSpecial ? 'hsl(221.2 83.2% 35%)' : '#fff',
              borderRadius: '5px',
              border: 'none',
            },
          }
        }}
        components={{ event: EventCard }}
        onSelectEvent={(event) => {
          if (event.session) setSelectedSession(event.session)
        }}
        formats={{
          timeGutterFormat: (date, culture, loc) => loc!.format(date, 'HH:mm', culture),
          eventTimeRangeFormat: () => '',
          dayRangeHeaderFormat: () => '',
        }}
        popup
      />

      {/* Session detail slide-in */}
      {selectedSession && createPortal(
        <>
          <div className="fixed inset-0 z-[200] bg-black/30" onClick={() => setSelectedSession(null)} />
          <div className="fixed inset-y-0 right-0 z-[201] w-full max-w-md bg-background border-l shadow-xl flex flex-col">
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
        </>,
        document.body
      )}
    </div>
  )
}
