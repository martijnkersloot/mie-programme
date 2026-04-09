import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProgramme } from '@/context'
import { formatDateShort } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import type { PresentationType, Session } from '@/types'
import { ArrowLeft, User } from 'lucide-react'

interface SessionEntry {
  date: string
  sessionId: string
  sessionName: string
  roomId: string
  start: string
  end: string
  presentations: { id: number; title: string; type: PresentationType }[]
}

function typeBadgeVariant(type: PresentationType): BadgeProps['variant'] {
  switch (type) {
    case 'Full paper':          return 'blue'
    case 'Short communication': return 'secondary'
    case 'Workshop':            return 'yellow'
    case 'Panel':               return 'purple'
    case 'Demo':                return 'green'
  }
}

export default function PresenterPage() {
  const { name: encodedName } = useParams<{ name: string }>()
  const name = decodeURIComponent(encodedName ?? '')
  const { data } = useProgramme()

  const roomLabelMap = useMemo(
    () => new Map((data?.rooms ?? []).map((r) => [r.id, r.nickname || r.label])),
    [data]
  )

  const sessions = useMemo<SessionEntry[]>(() => {
    if (!data || !name) return []
    const result: SessionEntry[] = []
    for (const day of data.days) {
      for (const event of day.events) {
        if (event.type !== 'session') continue
        const session = event as Session
        const matched = session.presentations.filter((p) => p.presenter === name)
        if (matched.length > 0) {
          result.push({
            date: day.date,
            sessionId: session.session_id,
            sessionName: session.name,
            roomId: session.room_id,
            start: session.start,
            end: session.end,
            presentations: matched.map((p) => ({ id: p.id, title: p.title, type: p.type })),
          })
        }
      }
    }
    return result
  }, [data, name])

  if (!data) return null

  const notFound = sessions.length === 0

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <Link
        to="/presenters"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All presenters
      </Link>

      {/* Heading */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">{name}</h1>
          {!notFound && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {sessions.reduce((a, s) => a + s.presentations.length, 0)} presentation
              {sessions.reduce((a, s) => a + s.presentations.length, 0) !== 1 ? 's' : ''}{' · '}
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Not found */}
      {notFound && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base font-medium">Presenter not found</p>
          <p className="text-sm mt-1">No presentations found for "{name}"</p>
        </div>
      )}

      {/* Session cards */}
      <div className="space-y-4">
        {sessions.map((s) => (
          <Link
            key={`${s.date}-${s.sessionId}`}
            to={`/list/${s.date}?session=${encodeURIComponent(s.sessionId)}`}
            className="block rounded-lg border bg-card hover:bg-muted/30 transition-colors group"
          >
            {/* Session header */}
            <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3 pb-2 border-b">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {s.sessionId} · {formatDateShort(s.date)} · {s.start}–{s.end}
                </p>
                <p className="text-sm font-semibold mt-0.5 group-hover:text-primary transition-colors">
                  {s.sessionName}
                </p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {roomLabelMap.get(s.roomId) ?? s.roomId}
              </Badge>
            </div>

            {/* Presentations */}
            <div className="px-4 divide-y">
              {s.presentations.map((p) => (
                <div key={p.id} className="py-2.5">
                  <Badge
                    variant={typeBadgeVariant(p.type)}
                    className="text-[10px] px-1.5 py-0 mb-1 font-medium"
                  >
                    {p.type}
                  </Badge>
                  <p className="text-sm font-medium leading-snug">{p.title}</p>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
