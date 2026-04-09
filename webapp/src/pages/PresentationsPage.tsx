import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProgramme } from '@/context'
import { formatDateShort } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PresenterLink from '@/components/PresenterLink'
import type { PresentationType, Session } from '@/types'
import { ExternalLink, Search } from 'lucide-react'

type TypeFilter = PresentationType | 'all'
type DayFilter = string | 'all'

function typeBadgeVariant(type: PresentationType): BadgeProps['variant'] {
  switch (type) {
    case 'Full paper':          return 'blue'
    case 'Short communication': return 'secondary'
    case 'Workshop':            return 'yellow'
    case 'Panel':               return 'purple'
    case 'Demo':                return 'green'
  }
}

const TYPES: PresentationType[] = ['Full paper', 'Short communication', 'Workshop', 'Panel', 'Demo']

interface SessionGroup {
  date: string
  session: Session
  presentationIndices: number[]
}

export default function PresentationsPage() {
  const { data } = useProgramme()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')

  const roomLabelMap = useMemo(
    () => new Map((data?.rooms ?? []).map((r) => [r.id, r.nickname || r.label])),
    [data]
  )

  const groups = useMemo<SessionGroup[]>(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const out: SessionGroup[] = []

    for (const day of data.days) {
      if (dayFilter !== 'all' && day.date !== dayFilter) continue
      for (const event of day.events) {
        if (event.type !== 'session') continue
        const session = event as Session
        const indices = session.presentations
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => {
            if (typeFilter !== 'all' && p.type !== typeFilter) return false
            if (!q) return true
            return p.title.toLowerCase().includes(q) || p.presenter.toLowerCase().includes(q)
          })
          .map(({ i }) => i)
        if (indices.length > 0) out.push({ date: day.date, session, presentationIndices: indices })
      }
    }
    return out
  }, [data, query, typeFilter, dayFilter])

  const totalCount = groups.reduce((acc, g) => acc + g.presentationIndices.length, 0)

  if (!data) return null

  return (
    <div className="max-w-3xl">

      {/* Sticky filters */}
      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-sm -mx-4 px-4 py-4 border-b mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by title or presenter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dayFilter} onValueChange={(v) => setDayFilter(v as DayFilter)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="All days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All days</SelectItem>
              {data.days.map((d) => (
                <SelectItem key={d.date} value={d.date}>{formatDateShort(d.date)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground mb-4">
        {totalCount} presentation{totalCount !== 1 ? 's' : ''} in {groups.length} session{groups.length !== 1 ? 's' : ''}
      </p>

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base font-medium">No presentations match your filters</p>
          <p className="text-sm mt-1">Try adjusting the type or day filter</p>
        </div>
      )}

      {/* Session groups */}
      <div className="space-y-4">
        {groups.map(({ date, session, presentationIndices }) => {
          const roomLabel =
            roomLabelMap.get(session.room_id) ?? session.room_id
          return (
            <div key={`${date}-${session.session_id}`} className="rounded-lg border bg-card">
              {/* Session header */}
              <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3 pb-2 border-b">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {session.session_id} · {formatDateShort(date)} · {session.start}–{session.end}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">{session.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{roomLabel}</Badge>
                  <Link
                    to={`/list/${date}?session=${encodeURIComponent(session.session_id)}`}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors"
                    title="View in schedule"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="hidden sm:inline">Schedule</span>
                  </Link>
                </div>
              </div>

              {/* Presentations */}
              <div className="px-4 divide-y">
                {presentationIndices.map((i) => {
                  const p = session.presentations[i]
                  return (
                    <div key={p.id} className="py-2.5">
                      <Badge
                        variant={typeBadgeVariant(p.type)}
                        className="text-[10px] px-1.5 py-0 mb-1 font-medium"
                      >
                        {p.type}
                      </Badge>
                      <p className="text-sm font-medium leading-snug">{p.title}</p>
                      <PresenterLink
                        name={p.presenter}
                        className="text-xs text-muted-foreground mt-0.5 block"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
