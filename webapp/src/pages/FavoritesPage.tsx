import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProgramme } from '@/context'
import { useFavorites } from '@/hooks/useFavorites'
import { formatDate, formatDateShort, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import PresenterLink from '@/components/PresenterLink'
import type { PresentationType, Session } from '@/types'
import { ExternalLink, Star } from 'lucide-react'

function typeBadgeVariant(type: PresentationType): BadgeProps['variant'] {
  switch (type) {
    case 'Full paper':          return 'blue'
    case 'Short communication': return 'secondary'
    case 'Workshop':            return 'yellow'
    case 'Panel':               return 'purple'
    case 'Demo':                return 'green'
  }
}

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

export default function FavoritesPage() {
  const { data } = useProgramme()
  const { favorites, isFavorite, toggleFavorite } = useFavorites()

  const roomLabelMap = useMemo(
    () => new Map((data?.rooms ?? []).map((r) => [r.id, r.nickname || r.label])),
    [data]
  )

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
    return result.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date)
      if (dateCmp !== 0) return dateCmp
      return a.start.localeCompare(b.start)
    })
  }, [data])

  const favorited = useMemo(
    () => allPresentations.filter((p) => isFavorite(p.id)),
    [allPresentations, favorites]
  )

  // Group by date
  const byDate = useMemo(() => {
    const map = new Map<string, FlatPresentation[]>()
    for (const p of favorited) {
      if (!map.has(p.date)) map.set(p.date, [])
      map.get(p.date)!.push(p)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [favorited])

  if (!data) return null

  if (favorites.size === 0) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold mb-6">My Favorites</h2>
        <div className="text-center py-16 text-muted-foreground">
          <Star className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No favorites yet</p>
          <p className="text-sm mt-1">
            Star presentations from the{' '}
            <Link to="/list" className="underline hover:text-foreground transition-colors">List</Link>
            {' '}or{' '}
            <Link to="/presentations" className="underline hover:text-foreground transition-colors">Presentations</Link>
            {' '}view
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">My Favorites</h2>
        <span className="text-sm text-muted-foreground">
          {favorited.length} presentation{favorited.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-8">
        {byDate.map(([date, presentations]) => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {formatDate(date)}
            </h3>
            <div className="rounded-lg border bg-card divide-y">
              {presentations.map((p) => {
                const roomLabel = roomLabelMap.get(p.roomId) ?? p.roomId
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
                      <div className="flex items-center gap-1 shrink-0 mt-1">
                        <button
                          onClick={() => toggleFavorite(p.id)}
                          className={cn(
                            'p-1 rounded-md transition-colors',
                            isFavorite(p.id)
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-muted-foreground hover:text-amber-500'
                          )}
                          aria-label="Remove from favorites"
                        >
                          <Star className={cn('h-3.5 w-3.5', isFavorite(p.id) && 'fill-current')} />
                        </button>
                        <Link
                          to={`/list/${p.date}?session=${encodeURIComponent(p.sessionId)}`}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          title="View in schedule"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.sessionId} · {formatDateShort(p.date)} · {p.start}–{p.end} · {roomLabel}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
