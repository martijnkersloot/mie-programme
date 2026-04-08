import { useState } from 'react'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import { Badge } from '@/components/ui/badge'
import type { Session, SpecialEvent } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'

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
            <span className="text-xs text-muted-foreground">
              {session.start}–{session.end}
            </span>
            <Badge variant="outline" className="text-xs">
              {roomLabel}
            </Badge>
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

export default function ListPage() {
  const { data } = useProgramme()

  if (!data) return null

  const roomLabelMap = new Map(data.rooms.map((r) => [r.id, r.nickname || r.label]))

  return (
    <div className="space-y-10">
      {data.days.map((day) => (
        <section key={day.date}>
          <h2 className="text-xl font-semibold mb-4 pb-2 border-b">{formatDate(day.date)}</h2>
          <div className="space-y-3">
            {day.events.map((event, i) => {
              if (event.type === 'special') {
                const e = event as SpecialEvent
                return (
                  <div
                    key={`special-${i}`}
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
                )
              }
              const session = event as Session
              return (
                <SessionRow
                  key={session.session_id}
                  session={session}
                  roomLabel={roomLabelMap.get(session.room_id) ?? session.room_id}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
