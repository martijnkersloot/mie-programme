import { useMemo, useState, useEffect, useContext, createContext } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Calendar, dateFnsLocalizer, type EventProps } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import type { Session } from '@/types'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// ─── calendar setup ──────────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

// ─── types ───────────────────────────────────────────────────────────────────

interface RBCEvent {
  title: string
  start: Date
  end: Date
  /** Set for single-session events */
  session?: Session
  /** Set for parallel-sessions events */
  sessions?: Session[]
  isSpecial: boolean
  roomId: string | null
}

// Context for wiring pill clicks inside EventCard → setSelectedSession
const SelectSessionCtx = createContext<(s: Session) => void>(() => {})

// ─── helpers ─────────────────────────────────────────────────────────────────

function toDate(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr.padStart(5, '0')}:00`)
}

// ─── event card ──────────────────────────────────────────────────────────────

function EventCard({ event }: EventProps<RBCEvent>) {
  const onSelect = useContext(SelectSessionCtx)

  // Parallel sessions: pill buttons for each session
  if (event.sessions && event.sessions.length > 1) {
    return (
      <div
        className="h-full flex flex-col gap-1 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide leading-none shrink-0 text-muted-foreground mb-1">
          Parallel sessions
        </p>
        <div className="flex flex-wrap gap-1 overflow-hidden">
          {event.sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => onSelect(s)}
              className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <span className="font-bold text-foreground">{s.session_id}</span>
              <span className="truncate max-w-[14ch]">{s.name}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Single session
  if (event.session) {
    return (
      <div className="h-full overflow-hidden leading-tight">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground leading-none mb-1">
          {event.session.session_id}
        </p>
        <p className="text-sm font-semibold text-foreground line-clamp-3">{event.title}</p>
      </div>
    )
  }

  // Special event (keynote, break, etc.)
  return (
    <div className="h-full overflow-hidden leading-tight">
      <p className="text-xs font-semibold line-clamp-3">{event.title}</p>
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const { data } = useProgramme()
  const { date: dateParam } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const sessionParam = searchParams.get('session')

  const roomLabelMap = useMemo(() => {
    const m = new Map<string, string>()
    data?.rooms.forEach((r) => m.set(r.id, r.nickname || r.label))
    return m
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

  const activeDay = useMemo(
    () => data?.days.find((d) => new Date(d.date + 'T12:00:00').toDateString() === activeDateObj.toDateString()),
    [data, activeDateObj]
  )

  // Auto-open session from ?session= param
  useEffect(() => {
    if (!sessionParam || !activeDay || selectedSession) return
    for (const event of activeDay.events) {
      if (event.type === 'session' && (event as Session).session_id === sessionParam) {
        setSelectedSession(event as Session)
        break
      }
    }
  }, [activeDay, sessionParam])

  // Build merged RBC events: group same-time sessions into one "Parallel sessions" event
  const allEvents = useMemo((): RBCEvent[] => {
    if (!data) return []
    return data.days.flatMap((day) => {
      // Group events by exact start|end key
      const slotMap = new Map<string, { sessions: Session[]; specials: typeof day.events }>()
      for (const e of day.events) {
        if (!e.start || !e.end) continue
        const key = `${e.start}|${e.end}`
        if (!slotMap.has(key)) slotMap.set(key, { sessions: [], specials: [] })
        const slot = slotMap.get(key)!
        if (e.type === 'session') slot.sessions.push(e as Session)
        else slot.specials.push(e)
      }

      const rbcEvents: RBCEvent[] = []

      for (const [key, { sessions, specials }] of slotMap) {
        const [startStr, endStr] = key.split('|')
        const start = toDate(day.date, startStr)
        const end = toDate(day.date, endStr)

        // Special events each get their own block
        for (const e of specials) {
          rbcEvents.push({
            title: e.name,
            start,
            end,
            isSpecial: true,
            roomId: e.room_id ?? null,
          })
        }

        if (sessions.length === 1) {
          rbcEvents.push({
            title: sessions[0].name,
            start,
            end,
            session: sessions[0],
            isSpecial: false,
            roomId: sessions[0].room_id,
          })
        } else if (sessions.length > 1) {
          rbcEvents.push({
            title: 'Parallel sessions',
            start,
            end,
            sessions,
            isSpecial: false,
            roomId: null,
          })
        }
      }

      return rbcEvents
    })
  }, [data])

  const { minTime, maxTime } = useMemo(() => {
    const dayEvts = activeDay?.events.filter((e) => e.start && e.end) ?? []
    if (dayEvts.length === 0) return { minTime: new Date(0, 0, 0, 8, 0), maxTime: new Date(0, 0, 0, 20, 0) }
    const minH = Math.max(0, Math.min(...dayEvts.map((e) => parseInt(e.start))) - 1)
    const rawMaxH = Math.max(...dayEvts.map((e) => parseInt(e.end))) + 1
    const maxTime = rawMaxH >= 24 ? new Date(0, 0, 0, 23, 59) : new Date(0, 0, 0, rawMaxH, 0)
    return { minTime: new Date(0, 0, 0, minH, 0), maxTime }
  }, [activeDay])

  const handleClosePanel = () => {
    setSelectedSession(null)
    if (searchParams.has('session')) {
      const next = new URLSearchParams(searchParams)
      next.delete('session')
      setSearchParams(next, { replace: true })
    }
  }

  const goToDay = (date: Date) => navigate(`/timetable/${date.toISOString().slice(0, 10)}`)

  if (!data) return null

  return (
    <SelectSessionCtx.Provider value={setSelectedSession}>
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

        {/* Calendar — day view, no resource columns */}
        <Calendar<RBCEvent>
          localizer={localizer}
          events={allEvents}
          defaultView="day"
          views={['day']}
          date={activeDateObj}
          onNavigate={(date) => {
            const match = conferenceDates.find((d) => d.toDateString() === date.toDateString())
            if (match) goToDay(match)
          }}
          min={minTime}
          max={maxTime}
          step={30}
          timeslots={2}
          style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
          dayLayoutAlgorithm="no-overlap"
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: event.isSpecial
                ? 'hsl(221.2 83.2% 53.3% / 0.15)'
                : 'white',
              color: event.isSpecial
                ? 'hsl(221.2 83.2% 35%)'
                : 'hsl(222.2 84% 4.9%)',
              borderRadius: '5px',
              border: '1px solid hsl(214.3 31.8% 91.4%)',
            },
          })}
          components={{ event: EventCard }}
          onSelectEvent={(event) => {
            // Single sessions: open panel directly. Parallel sessions handled by pill clicks.
            if (event.session) setSelectedSession(event.session)
          }}
          formats={{
            timeGutterFormat: (date, culture, loc) => loc!.format(date, 'HH:mm', culture),
            eventTimeRangeFormat: () => '',
            dayRangeHeaderFormat: () => '',
            dayHeaderFormat: () => '',
          }}
          toolbar={false}
          popup
        />

        {/* Session detail slide-in */}
        {selectedSession && createPortal(
          <>
            <div className="fixed inset-0 z-[200] bg-black/30" onClick={handleClosePanel} />
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
                  onClick={handleClosePanel}
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
    </SelectSessionCtx.Provider>
  )
}
