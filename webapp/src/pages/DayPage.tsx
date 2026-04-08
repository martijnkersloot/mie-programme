import { useMemo, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventContentArg } from '@fullcalendar/core'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import PresentationRow from '@/components/PresentationRow'
import type { Session } from '@/types'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

function toISO(date: string, time: string) {
  return `${date}T${time}:00`
}

export default function DayPage() {
  const { date } = useParams<{ date: string }>()
  const { data } = useProgramme()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const day = useMemo(() => data?.days.find((d) => d.date === date), [data, date])

  const resources = useMemo(() => {
    if (!day) return []
    const seen = new Set<string>()
    const result: { id: string; title: string }[] = [
      { id: '__programme__', title: 'Programme' },
    ]
    for (const e of day.events) {
      if (e.type === 'session') {
        const id = e.room_name || e.room
        if (!seen.has(id)) {
          seen.add(id)
          result.push({ id, title: id })
        }
      }
    }
    return result
  }, [day])

  const events = useMemo(() => {
    if (!day) return []
    return day.events.map((e) => {
      if (e.type === 'special') {
        return {
          id: `special-${e.start}`,
          resourceId: '__programme__',
          title: e.name,
          start: toISO(day.date, e.start),
          end: toISO(day.date, e.end),
          display: 'block' as const,
          backgroundColor: 'hsl(221.2 83.2% 53.3% / 0.12)',
          borderColor: 'hsl(221.2 83.2% 53.3% / 0.3)',
          textColor: 'hsl(221.2 83.2% 40%)',
          extendedProps: { isSpecial: true },
        }
      }
      return {
        id: e.session_id,
        resourceId: e.room_name || e.room,
        title: e.name,
        start: toISO(day.date, e.start),
        end: toISO(day.date, e.end),
        extendedProps: { session: e, sessionId: e.session_id },
      }
    })
  }, [day])

  // Determine slot range from data
  const { slotMinTime, slotMaxTime } = useMemo(() => {
    if (!day) return { slotMinTime: '08:00:00', slotMaxTime: '20:00:00' }
    const times = day.events.map((e) => e.start)
    const ends = day.events.map((e) => e.end)
    const minH = Math.max(0, Math.floor(Math.min(...times.map((t) => parseInt(t))) - 0))
    const maxH = Math.min(24, Math.ceil(Math.max(...ends.map((t) => parseInt(t))) + 1))
    return {
      slotMinTime: `${String(minH).padStart(2, '0')}:00:00`,
      slotMaxTime: `${String(maxH).padStart(2, '0')}:00:00`,
    }
  }, [day])

  const handleEventClick = (arg: EventClickArg) => {
    const session = arg.event.extendedProps.session as Session | undefined
    if (session) setSelectedSession(session)
  }

  const renderEventContent = (arg: EventContentArg) => {
    const sessionId = arg.event.extendedProps.sessionId as string | undefined
    return (
      <div className="px-1.5 py-1 overflow-hidden h-full">
        {sessionId && (
          <p className="text-[10px] font-semibold opacity-70 leading-none mb-0.5 uppercase tracking-wide">
            {sessionId}
          </p>
        )}
        <p className="text-xs font-semibold leading-snug line-clamp-2">{arg.event.title}</p>
      </div>
    )
  }

  if (!data) return null
  if (!day) return <Navigate to={`/day/${data.days[0]?.date}`} replace />

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{formatDate(day.date)}</h2>

      <div className="rounded-lg border overflow-hidden">
        <FullCalendar
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView="resourceTimeline"
          initialDate={date}
          headerToolbar={false}
          resources={resources}
          events={events}
          slotMinTime={slotMinTime}
          slotMaxTime={slotMaxTime}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          height="auto"
          resourceAreaWidth="140px"
          resourceAreaHeaderContent="Room"
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          eventColor="hsl(221.2 83.2% 53.3%)"
          nowIndicator
        />
      </div>

      {/* Session detail panel */}
      {selectedSession && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col">
          <div className="flex items-start justify-between gap-4 p-5 border-b">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {selectedSession.session_id} &middot; {selectedSession.start}–{selectedSession.end}
              </p>
              <h3 className="text-base font-semibold leading-snug">{selectedSession.name}</h3>
              <Badge variant="outline" className="mt-2 text-xs">
                {selectedSession.room_name || selectedSession.room}
              </Badge>
            </div>
            <button
              onClick={() => setSelectedSession(null)}
              className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              {selectedSession.presentations.length} presentation{selectedSession.presentations.length !== 1 ? 's' : ''}
            </p>
            {selectedSession.presentations.map((p) => (
              <PresentationRow key={p.id} presentation={p} />
            ))}
          </div>
        </div>
      )}
      {selectedSession && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setSelectedSession(null)}
        />
      )}
    </div>
  )
}
