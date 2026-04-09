import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProgramme } from '@/context'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { Session } from '@/types'
import { cn } from '@/lib/utils'

interface PresenterStats {
  presentations: number
  sessions: number
}

function usePresenterStats(name: string): PresenterStats {
  const { data } = useProgramme()
  return useMemo(() => {
    if (!data) return { presentations: 0, sessions: 0 }
    let presentations = 0
    let sessions = 0
    for (const day of data.days) {
      for (const event of day.events) {
        if (event.type !== 'session') continue
        const session = event as Session
        const matches = session.presentations.filter((p) => p.presenter === name)
        if (matches.length > 0) {
          presentations += matches.length
          sessions += 1
        }
      }
    }
    return { presentations, sessions }
  }, [data, name])
}

interface PresenterLinkProps {
  name: string
  className?: string
}

export default function PresenterLink({ name, className }: PresenterLinkProps) {
  const stats = usePresenterStats(name)
  const to = `/presenters/${encodeURIComponent(name)}`

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link
          to={to}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer',
            className
          )}
        >
          {name}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start">
        <p className="text-sm font-semibold leading-snug mb-1">{name}</p>
        <p className="text-xs text-muted-foreground">
          {stats.presentations} presentation{stats.presentations !== 1 ? 's' : ''}
          {' · '}
          {stats.sessions} session{stats.sessions !== 1 ? 's' : ''}
        </p>
        <Link
          to={to}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex text-xs text-primary hover:underline underline-offset-2"
        >
          View all presentations →
        </Link>
      </HoverCardContent>
    </HoverCard>
  )
}
