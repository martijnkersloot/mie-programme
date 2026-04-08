import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PresentationRow from './PresentationRow'
import type { Presentation, Session } from '@/types'

interface SessionCardProps {
  session: Session
  /** Pass false in timeline view where time is already shown on the timeline */
  showTime?: boolean
  filteredPresentations?: Presentation[]
}

export default function SessionCard({
  session,
  showTime = true,
  filteredPresentations,
}: SessionCardProps) {
  const presentations = filteredPresentations ?? session.presentations

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {session.session_id}
            </CardTitle>
            <CardTitle className="text-sm mt-0.5">{session.name}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {session.room_name || session.room}
          </Badge>
        </div>
        {showTime && (
          <CardDescription>
            {session.start}–{session.end}
          </CardDescription>
        )}
        {filteredPresentations && filteredPresentations.length !== session.presentations.length && (
          <CardDescription>
            <span className="text-primary font-medium">
              {filteredPresentations.length} of {session.presentations.length} shown
            </span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        <div>
          {presentations.map((p) => (
            <PresentationRow key={p.id} presentation={p} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
