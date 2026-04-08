import { useState } from 'react'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import { Badge } from '@/components/ui/badge'
import type { Event, Session, SpecialEvent } from '@/types'
import { ChevronDown, ChevronUp, LayoutGrid } from 'lucide-react'

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
  return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start))
}

// ─── components ─────────────────────────────────────────────────────────────

function SessionRow({ session, roomLabel }: { session: Session; roomLabel: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg bg-card">
      <button
        className="w-full flex items-start justify-between gap-4 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {session.session_id}
            </span>
            <span className="text-xs text-muted-foreground">{session.start}–{session.end}</span>
            <Badge variant="outline" className="text-xs">{roomLabel}</Badge>
          </div>
          <p className="text-sm font-semibold leading-snug">{session.name}</p>
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.presentations.length} presentation{session.presentations.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <span className="shrink-0 mt-1 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded && (
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
  roomLabelMap,
}: {
  group: TimeSlotGroup
  roomLabelMap: Map<string, string>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Parallel sessions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {group.start}–{group.end} · {group.sessions.length} sessions running simultaneously
            </p>
          </div>
        </div>
        <span className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Session pills when collapsed */}
      {!expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {group.sessions.map((s) => (
            <span
              key={s.session_id}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
            >
              <span className="font-medium text-foreground">{s.session_id}</span>
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: individual session rows */}
      {expanded && (
        <div className="border-t divide-y">
          {group.sessions.map((s) => (
            <div key={s.session_id} className="px-3 py-3">
              <SessionRow
                session={s}
                roomLabel={roomLabelMap.get(s.room_id) ?? s.room_id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ListPage() {
  const { data } = useProgramme()

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
                  {/* Special events always shown as banners */}
                  {group.specials.map((e, i) => (
                    <div
                      key={i}
                      className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between"
                    >
                      <span className="font-medium text-sm">{e.name}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0 ml-4">
                        <span>{e.start}–{e.end}</span>
                        {roomLabelMap.get(e.room_id) && (
                          <Badge variant="outline" className="text-xs">
                            {roomLabelMap.get(e.room_id)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Single session → plain row; multiple → parallel block */}
                  {group.sessions.length === 1 && (
                    <SessionRow
                      session={group.sessions[0]}
                      roomLabel={roomLabelMap.get(group.sessions[0].room_id) ?? group.sessions[0].room_id}
                    />
                  )}
                  {group.sessions.length > 1 && (
                    <ParallelSessionsBlock group={group} roomLabelMap={roomLabelMap} />
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
