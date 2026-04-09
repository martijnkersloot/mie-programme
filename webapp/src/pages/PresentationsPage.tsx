import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProgramme } from '@/context'
import { formatDateShort } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import PresenterLink from '@/components/PresenterLink'
import type { PresentationType, Session } from '@/types'
import { ExternalLink } from 'lucide-react'

type TypeFilter = PresentationType | 'all'

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

interface FlatPresentation {
  id: number
  title: string
  presenter: string
  type: PresentationType
  date: string
  sessionId: string
  sessionName: string
  roomId: string
  start: string
  end: string
}

export default function PresentationsPage() {
  const { data } = useProgramme()
  const [searchParams, setSearchParams] = useSearchParams()

  const typeFilter       = (searchParams.get('type') ?? 'all') as TypeFilter
  const selectedPresenters = searchParams.get('presenters')?.split(',').filter(Boolean) ?? []
  const selectedSessions   = searchParams.get('sessions')?.split(',').filter(Boolean) ?? []

  const setTypeFilter = (value: TypeFilter) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      if (value === 'all') next.delete('type')
      else next.set('type', value)
      return next
    }, { replace: true })
  }

  const setSelectedPresenters = (value: string[]) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      if (value.length === 0) next.delete('presenters')
      else next.set('presenters', value.join(','))
      return next
    }, { replace: true })
  }

  const setSelectedSessions = (value: string[]) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      if (value.length === 0) next.delete('sessions')
      else next.set('sessions', value.join(','))
      return next
    }, { replace: true })
  }

  const roomLabelMap = useMemo(
    () => new Map((data?.rooms ?? []).map((r) => [r.id, r.nickname || r.label])),
    [data]
  )

  // Flat list of all presentations with session context
  const allPresentations = useMemo<FlatPresentation[]>(() => {
    if (!data) return []
    const result: FlatPresentation[] = []
    for (const day of data.days) {
      for (const event of day.events) {
        if (event.type !== 'session') continue
        const session = event as Session
        for (const p of session.presentations) {
          result.push({
            id: p.id,
            title: p.title,
            presenter: p.presenter,
            type: p.type,
            date: day.date,
            sessionId: session.session_id,
            sessionName: session.name,
            roomId: session.room_id,
            start: session.start,
            end: session.end,
          })
        }
      }
    }
    // Sort alphabetically by title
    return result.sort((a, b) => a.title.localeCompare(b.title))
  }, [data])

  // Presenter options (sorted A–Z)
  const presenterOptions = useMemo(() => {
    const names = [...new Set(allPresentations.map((p) => p.presenter))].sort((a, b) =>
      a.localeCompare(b)
    )
    return names.map((n) => ({ value: n, label: n }))
  }, [allPresentations])

  // Session options (sorted by date + start time)
  const sessionOptions = useMemo(() => {
    const seen = new Map<string, FlatPresentation>()
    for (const p of allPresentations) {
      if (!seen.has(p.sessionId)) seen.set(p.sessionId, p)
    }
    return [...seen.values()]
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
      .map((p) => ({
        value: p.sessionId,
        label: p.sessionId,
        sublabel: `${p.sessionName} · ${formatDateShort(p.date)}`,
      }))
  }, [allPresentations])

  // Filtered + sorted result
  const filtered = useMemo(() => {
    return allPresentations.filter((p) => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (selectedPresenters.length > 0 && !selectedPresenters.includes(p.presenter)) return false
      if (selectedSessions.length > 0 && !selectedSessions.includes(p.sessionId)) return false
      return true
    })
  }, [allPresentations, typeFilter, selectedPresenters, selectedSessions])

  if (!data) return null

  return (
    <div className="max-w-3xl">

      {/* Sticky filters */}
      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-sm -mx-4 px-4 py-4 border-b mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MultiSelect
            options={presenterOptions}
            value={selectedPresenters}
            onChange={setSelectedPresenters}
            placeholder="All presenters"
            searchPlaceholder="Search presenters…"
            className="sm:flex-1"
          />
          <MultiSelect
            options={sessionOptions}
            value={selectedSessions}
            onChange={setSelectedSessions}
            placeholder="All sessions"
            searchPlaceholder="Search sessions…"
            className="sm:flex-1"
          />
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} presentation{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base font-medium">No presentations match your filters</p>
          <p className="text-sm mt-1">Try adjusting the filters above</p>
        </div>
      )}

      {/* Flat alphabetical list */}
      <div className="rounded-lg border bg-card divide-y">
        {filtered.map((p) => {
          const roomLabel = roomLabelMap.get(p.roomId) ?? p.roomId
          // Composite key: the data contains duplicate presentation IDs across sessions,
          // so p.id alone is not unique enough for React reconciliation.
          const rowKey = `${p.date}-${p.sessionId}-${p.id}`
          return (
            <div key={rowKey} className="px-4 py-3 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
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
                <Link
                  to={`/list/${p.date}?session=${encodeURIComponent(p.sessionId)}`}
                  className="shrink-0 text-muted-foreground hover:text-primary transition-colors mt-1"
                  title="View in schedule"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.sessionId} · {formatDateShort(p.date)} · {p.start}–{p.end} · {roomLabel}
              </p>
            </div>
          )
        })}
      </div>

      {data.meta && (
        <p className="mt-6 text-xs text-muted-foreground text-center">
          Last import: {new Date(data.meta.imported_at).toLocaleString()} &middot;{' '}
          Source: {data.meta.source_filename} (modified{' '}
          {new Date(data.meta.source_file_modified).toLocaleDateString()})
        </p>
      )}
    </div>
  )
}
