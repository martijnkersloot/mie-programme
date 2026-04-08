import { useState } from 'react'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import { Badge } from '@/components/ui/badge'
import type { Event, Session, SpecialEvent } from '@/types'
import { ChevronDown, ChevronUp, LayoutGrid, X } from 'lucide-react'

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

// ─── components ─────────────────────────────────────────────────────────────

function SessionRow({ session, roomLabel, onSelect }: {
  session: Session
  roomLabel: string
  onSelect?: (s: Session) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg bg-card">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => onSelect ? onSelect(session) : setExpanded((v) => !v)}
      >
        {/* Time */}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground w-24">
          {session.start}–{session.end}
        </span>

        {/* Name + count */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{session.name}</p>
          {!expanded && !onSelect && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.presentations.length} presentation{session.presentations.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Location */}
        <Badge variant="outline" className="text-xs shrink-0">{roomLabel}</Badge>

        {/* Chevron — only when used inline (no onSelect) */}
        {!onSelect && (
          <span className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </button>

      {expanded && !onSelect && (
        <div className="border-t px-4 pb-3 pt-1">
          {session.presentations.map((p) => (
            <PresentationRow key={p.id} presentation={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function ParallelSessionsBlock({
  group,
  onSelectSession,
}: {
  group: TimeSlotGroup
  onSelectSession: (s: Session) => void
}) {
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header — informational only */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground w-24">
          {group.start}–{group.end}
        </span>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Parallel sessions</p>
            <p className="text-xs text-muted-foreground">
              {group.sessions.length} sessions running simultaneously
            </p>
          </div>
        </div>
      </div>

      {/* Clickable session pills */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {group.sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => onSelectSession(s)}
            className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <span className="font-medium text-foreground">{s.session_id}</span>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── slide-in panel ──────────────────────────────────────────────────────────

function SessionPanel({
  session,
  roomLabel,
  onClose,
}: {
  session: Session
  roomLabel: string
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col">
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
    </>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ListPage() {
  const { data } = useProgramme()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  if (!data) return null

  const roomLabelMap = new Map(data.rooms.map((r) => [r.id, r.nickname || r.label]))

  return (
    <div className="space-y-10">
      {data.days.map((day) => {
        const groups = groupByTimeSlot(day.events)
        return (
          <section key={day.date}>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">{formatDate(day.date)}</h2>
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={`${group.start}|${group.end}`} className="space-y-3">
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

                  {/* Single session → inline expand; multiple → parallel block with side panel */}
                  {group.sessions.length === 1 && (
                    <SessionRow
                      session={group.sessions[0]}
                      roomLabel={roomLabelMap.get(group.sessions[0].room_id) ?? group.sessions[0].room_id}
                    />
                  )}
                  {group.sessions.length > 1 && (
                    <ParallelSessionsBlock
                      group={group}
                      onSelectSession={setSelectedSession}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {selectedSession && (
        <SessionPanel
          session={selectedSession}
          roomLabel={roomLabelMap.get(selectedSession.room_id) ?? selectedSession.room_id}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  )
}
