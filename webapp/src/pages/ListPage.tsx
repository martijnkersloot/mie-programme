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
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Time */}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground w-24">
          {session.start}–{session.end}
        </span>

        {/* Name + count */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{session.name}</p>
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.presentations.length} presentation{session.presentations.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Location */}
        <Badge variant="outline" className="text-xs shrink-0">{roomLabel}</Badge>

        {/* Chevron */}
        <span className="shrink-0 text-muted-foreground">
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
    <div
      className="border rounded-lg bg-card overflow-hidden"
      onClick={() => !expanded && setExpanded(true)}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
      >
        {/* Time */}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground w-24">
          {group.start}–{group.end}
        </span>

        {/* Label */}
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Parallel sessions</p>
            <p className="text-xs text-muted-foreground">
              {group.sessions.length} sessions running simultaneously
            </p>
          </div>
        </div>

        {/* Chevron */}
        <span className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Session pills when collapsed — clicking anywhere here also expands */}
      {!expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5 cursor-pointer">
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
        <div className="border-t divide-y" onClick={(e) => e.stopPropagation()}>
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
