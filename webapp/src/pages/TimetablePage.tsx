import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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
  '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#ea580c', '#65a30d',
]

interface RBCEvent {
  title: string
  start: Date
  end: Date
  /** Custom session payload — renamed to avoid clash with rbc's own `resource` accessor */
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

  // Resources = one entry per room, used as calendar columns
  const resources = useMemo((): RBCResource[] =>
    data?.rooms.map((r) => ({ id: r.id, title: r.nickname || r.label })) ?? [],
    [data]
  )

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
        session: e.type === 'session' ? e : undefined,
      }))
    )
  }, [data])

  const { minTime, maxTime } = useMemo(() => {
    if (!data) return { minTime: new Date(0, 0, 0, 8, 0), maxTime: new Date(0, 0, 0, 20, 0) }
    const allEvts = data.days.flatMap((d) => d.events)
    const minH = Math.max(0, Math.min(...allEvts.map((e) => parseInt(e.start))) - 1)
    const maxH = Math.min(24, Math.max(...allEvts.map((e) => parseInt(e.end))) + 1)
    return { minTime: new Date(0, 0, 0, minH, 0), maxTime: new Date(0, 0, 0, maxH, 0) }
  }, [data])

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
      {/* Day tabs */}
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

      {/* Calendar with resource columns */}
      <Calendar<RBCEvent, RBCResource>
        localizer={localizer}
        events={allEvents}
        defaultView="day"
        views={['day']}
        date={activeDateObj}
        onNavigate={(date) => {
          const match = conferenceDates.find((d) => d.toDateString() === date.toDateString())
          if (match) setCurrentDate(match)
        }}
        resources={resources}
        resourceIdAccessor="id"
        resourceTitleAccessor="title"
        resourceAccessor="roomId"
        min={minTime}
        max={maxTime}
        step={30}
        timeslots={2}
        style={{ height: 'calc(100vh - 260px)', minHeight: 500 }}
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
