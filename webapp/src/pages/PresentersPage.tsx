import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProgramme } from '@/context'
import { formatDateShort } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Session } from '@/types'
import { Search, Users } from 'lucide-react'

interface PresenterEntry {
  date: string
  sessionId: string
  sessionName: string
  roomId: string
  start: string
  end: string
  presentationTitle: string
  presentationId: number
}

function buildPresenterMap(
  days: { date: string; events: { type: string }[] }[]
): Map<string, PresenterEntry[]> {
  const map = new Map<string, PresenterEntry[]>()
  for (const day of days) {
    for (const event of day.events) {
      if (event.type !== 'session') continue
      const session = event as Session
      for (const p of session.presentations) {
        const entry: PresenterEntry = {
          date: day.date,
          sessionId: session.session_id,
          sessionName: session.name,
          roomId: session.room_id,
          start: session.start,
          end: session.end,
          presentationTitle: p.title,
          presentationId: p.id,
        }
        if (!map.has(p.presenter)) map.set(p.presenter, [])
        map.get(p.presenter)!.push(entry)
      }
    }
  }
  return map
}

export default function PresentersPage() {
  const { data } = useProgramme()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = searchParams.get('q') ?? ''

  const setFilter = (value: string) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  const roomLabelMap = useMemo(
    () => new Map((data?.rooms ?? []).map((r) => [r.id, r.nickname || r.label])),
    [data]
  )

  const presenterMap = useMemo(() => {
    if (!data) return new Map<string, PresenterEntry[]>()
    return buildPresenterMap(data.days as Parameters<typeof buildPresenterMap>[0])
  }, [data])

  const sortedNames = useMemo(
    () => Array.from(presenterMap.keys()).sort((a, b) => a.localeCompare(b)),
    [presenterMap]
  )

  const filteredNames = useMemo(() => {
    const q = filter.toLowerCase()
    return q ? sortedNames.filter((n) => n.toLowerCase().includes(q)) : sortedNames
  }, [sortedNames, filter])

  if (!data) return null

  return (
    <div className="max-w-3xl">
      {/* Filter */}
      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-sm -mx-4 px-4 py-4 border-b mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Filter by presenter name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Summary */}
      {filteredNames.length > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          {filteredNames.length} presenter{filteredNames.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Empty state */}
      {filteredNames.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-base font-medium">No presenters match your search</p>
          <p className="text-sm mt-1">Try a different name</p>
        </div>
      )}

      {/* Presenter list */}
      <div className="space-y-3">
        {filteredNames.map((name) => {
          const entries = presenterMap.get(name)!
          return (
            <div key={name} className="rounded-lg border bg-card overflow-hidden">
              {/* Presenter header */}
              <div className="px-4 py-2.5 border-b bg-muted/30">
                <Link
                  to={`/presenters/${encodeURIComponent(name)}`}
                  className="text-sm font-semibold hover:text-primary transition-colors"
                >
                  {name}
                </Link>
              </div>

              {/* Sessions */}
              <div className="divide-y">
                {entries.map((entry) => (
                  <Link
                    key={entry.presentationId}
                    to={`/timetable/${entry.date}?session=${encodeURIComponent(entry.sessionId)}`}
                    className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug group-hover:text-primary transition-colors">
                        {entry.presentationTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDateShort(entry.date)} · {entry.start}–{entry.end}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {entry.sessionId}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {roomLabelMap.get(entry.roomId) ?? entry.roomId}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
