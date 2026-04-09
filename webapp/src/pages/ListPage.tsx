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

const PX_PER_MINUTE = 1.5   // 1 hour = 90 px
const GUTTER_W      = 48    // px — time label column
const COL_GAP       = 4     // px — gap between overlapping columns

const ROOM_COLORS = [
  '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#ea580c', '#65a30d',
]

// ─── helpers ────────────────────────────────────────────────────────────────

function toMin(t: string): number {
  const [h, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}

// ─── layout algorithm ────────────────────────────────────────────────────────
//
// Groups events by exact (start, end) pair — same as before.
// Then assigns columns so that overlapping groups (different time windows)
// sit side by side rather than on top of each other.

interface LayoutGroup {
  start: string
  end: string
  startMin: number
  endMin: number
  specials: SpecialEvent[]
  sessions: Session[]
  col: number      // 0-based column for this group
  numCols: number  // total simultaneous columns at this point in time
}

function buildLayout(events: Event[]): LayoutGroup[] {
  // 1. Group by exact time window
  const map = new Map<string, LayoutGroup>()
  for (const e of events) {
    const key = `${e.start}|${e.end}`
    if (!map.has(key)) {
      map.set(key, {
        start: e.start, end: e.end,
        startMin: toMin(e.start), endMin: toMin(e.end),
        specials: [], sessions: [], col: 0, numCols: 1,
      })
    }
    const g = map.get(key)!
    if (e.type === 'special') g.specials.push(e as SpecialEvent)
    else g.sessions.push(e as Session)
  }

  const items = Array.from(map.values())
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  // 2. Greedy column assignment
  const colEnds: number[] = []   // earliest end time per column
  for (const item of items) {
    const col = colEnds.findIndex(end => end <= item.startMin)
    item.col = col === -1 ? colEnds.length : col
    if (col === -1) colEnds.push(item.endMin)
    else colEnds[col] = item.endMin
  }

  // 3. Compute numCols: max column span across all items that overlap this one
  for (const item of items) {
    const peers = items.filter(
      o => o !== item && o.startMin < item.endMin && o.endMin > item.startMin
    )
    const span = peers.length > 0
      ? Math.max(item.col, ...peers.map(o => o.col)) + 1
      : item.col + 1
    item.numCols = span
    peers.forEach(o => { o.numCols = Math.max(o.numCols, span) })
  }

  return items
}

// ─── inner components ────────────────────────────────────────────────────────

function SingleSessionBlock({
  session, roomLabel, accentColor, onSelect,
}: {
  session: Session
  roomLabel: string
  accentColor: string
  onSelect: (s: Session) => void
}) {
  return (
    <button
      onClick={() => onSelect(session)}
      className="w-full h-full text-left rounded-md border bg-card hover:bg-muted/40 transition-colors p-2 flex flex-col gap-1 overflow-hidden"
      style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}
    >
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide leading-none truncate">
        {session.session_id}
      </p>
      <p className="text-xs font-semibold leading-snug line-clamp-3">{session.name}</p>
      <Badge variant="outline" className="text-[10px] px-1 py-0 self-start">{roomLabel}</Badge>
    </button>
  )
}

function ParallelSessionsBlock({
  group, roomLabelMap, onSelectSession,
}: {
  group: LayoutGroup
  roomLabelMap: Map<string, string>
  onSelectSession: (s: Session) => void
}) {
  return (
    <div className="w-full h-full rounded-md border bg-card p-2 flex flex-col gap-1.5 overflow-hidden">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
        Parallel sessions
      </p>
      <div className="flex flex-wrap gap-1 overflow-hidden">
        {group.sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => onSelectSession(s)}
            className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <span className="font-semibold text-foreground">{s.session_id}</span>
            <span className="truncate max-w-[12ch]">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function SpecialBlock({ event }: { event: SpecialEvent }) {
  return (
    <div className="w-full h-full rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 flex flex-col justify-center overflow-hidden">
      <p className="text-xs font-medium leading-snug line-clamp-2">{event.name}</p>
    </div>
  )
}

// ─── slide-in panel ──────────────────────────────────────────────────────────

function SessionPanel({ session, roomLabel, onClose }: {
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
          <button onClick={onClose} className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors">
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

  const groups = useMemo(() => day ? buildLayout(day.events) : [], [day])

  // Time range — rounded to whole hours, padded by 0 min at top and bottom
  const { minMin, maxMin, hours } = useMemo(() => {
    if (groups.length === 0) return { minMin: 480, maxMin: 1200, hours: [] }
    const minMin = Math.floor(Math.min(...groups.map(g => g.startMin)) / 60) * 60
    const maxMin = Math.ceil(Math.max(...groups.map(g => g.endMin)) / 60) * 60
    const hrs: number[] = []
    for (let m = minMin; m <= maxMin; m += 60) hrs.push(m)
    return { minMin, maxMin, hours: hrs }
  }, [groups])

  const containerH = (maxMin - minMin) * PX_PER_MINUTE + 16  // 16px bottom padding

  if (!data || !day) return null

  const goToDay = (idx: number) => navigate(`/list/${data.days[idx].date}`)

  return (
    <div>
      {/* Date heading + prev/next */}
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

      {/* Timeline */}
      <div className="relative" style={{ height: containerH }}>

        {/* Hour labels + grid lines */}
        {hours.map((m) => {
          const top = (m - minMin) * PX_PER_MINUTE
          const label = `${String(m / 60 | 0).padStart(2, '0')}:00`
          return (
            <div key={m} className="absolute left-0 right-0 flex items-center pointer-events-none" style={{ top }}>
              <span
                className="text-[11px] tabular-nums text-muted-foreground select-none leading-none"
                style={{ width: GUTTER_W, paddingRight: 8, textAlign: 'right' }}
              >
                {label}
              </span>
              <div className="flex-1 border-t border-border/40" />
            </div>
          )
        })}

        {/* Event blocks */}
        {groups.map((g) => {
          const top    = (g.startMin - minMin) * PX_PER_MINUTE + 2
          const height = Math.max((g.endMin - g.startMin) * PX_PER_MINUTE - 4, 28)
          const leftPct  = g.col / g.numCols
          const widthPct = 1 / g.numCols

          // Within the events area (everything right of gutter):
          //   left  = GUTTER_W + leftPct  * eventsWidth + col * COL_GAP
          //   width = widthPct * eventsWidth - (numCols-1)*COL_GAP/numCols
          // We can't compute eventsWidth in CSS without calc trickery, but
          // calc(X% - Ypx) on a flex child works when the parent excludes the gutter.
          // So we put gutter and events area as two siblings.

          return (
            <div
              key={`${g.start}|${g.end}`}
              className="absolute"
              style={{
                top,
                height,
                left:  `calc(${GUTTER_W}px + ${leftPct * 100}% - ${leftPct * GUTTER_W}px + ${g.col * COL_GAP}px)`,
                right: `calc(${(1 - leftPct - widthPct) * 100}% - ${(1 - leftPct - widthPct) * GUTTER_W}px + ${(g.numCols - g.col - 1) * COL_GAP}px)`,
              }}
            >
              {/* Special events take the full block */}
              {g.specials.length > 0 && g.sessions.length === 0 && (
                <SpecialBlock event={g.specials[0]} />
              )}

              {/* Single session */}
              {g.sessions.length === 1 && (
                <SingleSessionBlock
                  session={g.sessions[0]}
                  roomLabel={roomLabelMap.get(g.sessions[0].room_id) ?? g.sessions[0].room_id}
                  accentColor={roomColorMap.get(g.sessions[0].room_id) ?? '#94a3b8'}
                  onSelect={setSelectedSession}
                />
              )}

              {/* Parallel sessions */}
              {g.sessions.length > 1 && (
                <ParallelSessionsBlock
                  group={g}
                  roomLabelMap={roomLabelMap}
                  onSelectSession={setSelectedSession}
                />
              )}

              {/* Mixed: specials + sessions in the same time slot (rare) */}
              {g.specials.length > 0 && g.sessions.length > 0 && (
                <div className="absolute inset-0 flex flex-col gap-1 overflow-hidden">
                  {g.specials.map((e, i) => (
                    <SpecialBlock key={i} event={e} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
