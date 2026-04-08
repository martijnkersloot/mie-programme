import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProgramme } from '@/context'
import { formatDateShort } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PresentationRow from '@/components/PresentationRow'
import type { PresentationType, Session } from '@/types'
import { Search } from 'lucide-react'

type TypeFilter = PresentationType | 'all'
type DayFilter = string | 'all'

interface SearchResult {
  date: string
  session: Session
  presentationIndices: number[]
}

export default function SearchPage() {
  const { data } = useProgramme()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')

  const results = useMemo<SearchResult[]>(() => {
    if (!data || !query.trim()) return []
    const q = query.toLowerCase()

    const out: SearchResult[] = []
    for (const day of data.days) {
      if (dayFilter !== 'all' && day.date !== dayFilter) continue
      for (const event of day.events) {
        if (event.type !== 'session') continue
        const session = event as Session
        const matchingIndices = session.presentations
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => {
            const matchesType = typeFilter === 'all' || p.type === typeFilter
            const matchesQuery = p.title.toLowerCase().includes(q) || p.presenter.toLowerCase().includes(q)
            return matchesType && matchesQuery
          })
          .map(({ i }) => i)
        if (matchingIndices.length > 0) {
          out.push({ date: day.date, session, presentationIndices: matchingIndices })
        }
      }
    }
    return out
  }, [data, query, typeFilter, dayFilter])

  const totalHits = results.reduce((acc, r) => acc + r.presentationIndices.length, 0)
  const hasQuery = query.trim().length > 0

  const TYPES: PresentationType[] = ['Full paper', 'Short communication', 'Workshop', 'Panel', 'Demo']

  return (
    <div className="max-w-3xl">

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by title or presenter…"
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
        {data && (
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
        )}
      </div>

      {/* Results */}
      {!hasQuery && (
        <p className="text-sm text-muted-foreground text-center py-16">
          Start typing to search across all presentations
        </p>
      )}

      {hasQuery && results.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base font-medium">No results found</p>
          <p className="text-sm mt-1">Try a different search term or adjust the filters</p>
        </div>
      )}

      {hasQuery && results.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {totalHits} presentation{totalHits !== 1 ? 's' : ''} in {results.length} session{results.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-4">
            {results.map(({ date, session, presentationIndices }) => (
              <div key={`${date}-${session.session_id}`} className="rounded-lg border bg-card">
                {/* Session header */}
                <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3 pb-2 border-b">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {session.session_id} · {formatDateShort(date)} · {session.start}–{session.end}
                    </p>
                    <p className="text-sm font-semibold mt-0.5">{session.name}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {data?.rooms.find((r) => r.id === session.room_id)?.nickname ||
                      data?.rooms.find((r) => r.id === session.room_id)?.label ||
                      session.room_id}
                  </Badge>
                </div>
                {/* Matching presentations */}
                <div className="px-4 py-1">
                  {presentationIndices.map((i) => (
                    <PresentationRow key={session.presentations[i].id} presentation={session.presentations[i]} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
