import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import { Badge } from '@/components/ui/badge'
import type { Event, Session, SpecialEvent } from '@/types'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

// ─── constants ───────────────────────────────────────────────────────────────

const ROOM_COLORS = [
  '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#ea580c', '#65a30d',
]

// ─── helpers ────────────────────────────────────────────────────────────────

interface TimeSlotGroup {
  start: string
  end: string
  specials: SpecialEvent[]
  sessions: Session[]
}

function groupByTimeSlot(events: Event[]): TimeSlotGroup[] {
  const map = new Map<string, TimeSlotGroup>()
  for (const e of events) {
    const key = `${e.start}|${e.end}`
    if (!map.has(key)) map.set(key, { start: e.start, end: e.end, specials: [], sessions: [] })
    const g = map.get(key)!
    if (e.type === 'special') g.specials.push(e as SpecialEvent)
    else g.sessions.push(e as Session)
  }
  const pad = (t: string) => t.padStart(5, '0')
  return Array.from(map.values()).sort((a, b) => pad(a.start).localeCompare(pad(b.start)))
}

// ─── session card (used for both single and parallel) ────────────────────────

function SessionCard({
  session,
  roomLabel,
  accentColor,
  showTime,
  onSelect,
}: {
  session: Session
  roomLabel: string
  accentColor: string
  showTime: boolean
  onSelect: (s: Session) => void
}) {
  return (
    <button
      onClick={() => onSelect(session)}
      className="w-full text-left rounded-lg border bg-card hover:bg-muted/40 transition-colors p-3 flex flex-col gap-1.5 overflow-hidden"
      style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {showTime && (
            <p className="text-xs tabular-nums text-muted-foreground mb-1">
              {session.start}–{session.end}
            </p>
          )}
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide leading-none">
            {session.session_id}
          </p>
          <p className="text-sm font-semibold leading-snug mt-1">{session.name}</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{roomLabel}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {session.presentations.length} presentation{session.presentations.length !== 1 ? 's' : ''}
      </p>
    </button>
  )
}

// ─── parallel sessions grid ──────────────────────────────────────────────────

function ParallelSessionsBlock({
  group,
  roomLabelMap,
  roomColorMap,
  onSelectSession,
}: {
  group: TimeSlotGroup
  roomLabelMap: Map<string, string>
  roomColorMap: Map<string, string>
  onSelectSession: (s: Session) => void
}) {
  const cols = group.sessions.length <= 2
    ? 'sm:grid-cols-2'
    : group.sessions.length <= 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="space-y-2">
      {/* Time + parallel label */}
      <div className="flex items-baseline gap-2">
        <span className="text-xs tabular-nums font-medium text-muted-foreground">
          {group.start}–{group.end}
        </span>
        <span className="text-xs text-muted-foreground">
          · {group.sessions.length} parallel sessions
        </span>
      </div>
      {/* Grid of session cards */}
      <div className={`grid grid-cols-1 gap-2 ${cols}`}>
        {group.sessions.map((s) => (
          <SessionCard
            key={s.session_id}
            session={s}
            roomLabel={roomLabelMap.get(s.room_id) ?? s.room_id}
            accentColor={roomColorMap.get(s.room_id) ?? '#94a3b8'}
            showTime={false}
            onSelect={onSelectSession}
          />
        ))}
      </div>
    </div>
  )
}

// ─── slide-in panel (rendered via portal so it covers the sticky header) ────

function SessionPanel({
  session,
  roomLabel,
  onClose,
}: {
  session: Session
  roomLabel: string
  onClose: () => void
}) {
  return createPortal(
    <>
      <div className="fixed inset-0 z-[200] bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[201] w-full max-w-md bg-background border-l shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {session.session_id} · {session.start}–{session.end}
            </p>
            <h3 className="text-base font-semibold leading-snug">{session.name}</h3>
            <Badge variant="outline" className="mt-2 text-xs">{roomLabel}</Badge>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-xs text-muted-foreground mb-3 font-medium">
            {session.presentations.length} presentation{session.presentations.length !== 1 ? 's' : ''}
          </p>
          {session.presentations.map((p) => (
            <PresentationRow key={p.id} presentation={p} />
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ListPage() {
  const { data } = useProgramme()
  const { date: dateParam } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const sessionParam = searchParams.get('session')

  const dayIdx = data
    ? dateParam
      ? Math.max(0, data.days.findIndex((d) => d.date === dateParam))
      : 0
    : 0
  const day = data?.days[dayIdx]

  useEffect(() => {
    if (!sessionParam || !day || selectedSession) return
    for (const event of day.events) {
      if (event.type === 'session' && (event as Session).session_id === sessionParam) {
        setSelectedSession(event as Session)
        break
      }
    }
  }, [day, sessionParam])

  const handleClosePanel = () => {
    setSelectedSession(null)
    if (searchParams.has('session')) {
      const next = new URLSearchParams(searchParams)
      next.delete('session')
      setSearchParams(next, { replace: true })
    }
  }

  const roomLabelMap = useMemo(
    () => new Map((data?.rooms ?? []).map((r) => [r.id, r.nickname || r.label])),
    [data]
  )

  const roomColorMap = useMemo(
    () => new Map((data?.rooms ?? []).map((r, i) => [r.id, ROOM_COLORS[i % ROOM_COLORS.length]])),
    [data]
  )

  if (!data || !day) return null

  const groups = groupByTimeSlot(day.events)
  const goToDay = (idx: number) => navigate(`/list/${data.days[idx].date}`)

  return (
    <div>
      {/* Date heading + prev/next buttons */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">{formatDate(day.date)}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToDay(dayIdx - 1)}
            disabled={dayIdx === 0}
            className="p-1.5 rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToDay(dayIdx + 1)}
            disabled={dayIdx === data.days.length - 1}
            className="p-1.5 rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Events for the active day */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={`${group.start}|${group.end}`} className="space-y-2">

            {/* Special events */}
            {group.specials.map((e, i) => (
              <div
                key={i}
                className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3"
              >
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground w-24">
                  {e.start}–{e.end}
                </span>
                <span className="flex-1 font-medium text-sm">{e.name}</span>
                {roomLabelMap.get(e.room_id) && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {roomLabelMap.get(e.room_id)}
                  </Badge>
                )}
              </div>
            ))}

            {/* Single session */}
            {group.sessions.length === 1 && (
              <SessionCard
                session={group.sessions[0]}
                roomLabel={roomLabelMap.get(group.sessions[0].room_id) ?? group.sessions[0].room_id}
                accentColor={roomColorMap.get(group.sessions[0].room_id) ?? '#94a3b8'}
                showTime
                onSelect={setSelectedSession}
              />
            )}

            {/* Parallel sessions */}
            {group.sessions.length > 1 && (
              <ParallelSessionsBlock
                group={group}
                roomLabelMap={roomLabelMap}
                roomColorMap={roomColorMap}
                onSelectSession={setSelectedSession}
              />
            )}
          </div>
        ))}
      </div>

      {selectedSession && (
        <SessionPanel
          session={selectedSession}
          roomLabel={roomLabelMap.get(selectedSession.room_id) ?? selectedSession.room_id}
          onClose={handleClosePanel}
        />
      )}
    </div>
  )
}
