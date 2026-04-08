import { useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useProgramme } from '@/context'
import { formatDate } from '@/lib/utils'
import SessionCard from '@/components/SessionCard'
import type { Event, Session, SpecialEvent } from '@/types'

interface TimeSlot {
  start: string
  end: string
  events: Event[]
}

function groupByTimeSlot(events: Event[]): TimeSlot[] {
  const map = new Map<string, TimeSlot>()
  for (const event of events) {
    const key = `${event.start}-${event.end}`
    if (!map.has(key)) {
      map.set(key, { start: event.start, end: event.end, events: [] })
    }
    map.get(key)!.events.push(event)
  }
  return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start))
}

export default function DayPage() {
  const { date } = useParams<{ date: string }>()
  const { data } = useProgramme()

  const day = useMemo(() => data?.days.find((d) => d.date === date), [data, date])
  const timeSlots = useMemo(() => (day ? groupByTimeSlot(day.events) : []), [day])

  if (!data) return null
  if (!day) return <Navigate to={`/day/${data.days[0]?.date}`} replace />

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">{formatDate(day.date)}</h2>

      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[4.5rem] top-0 bottom-0 w-px bg-border hidden sm:block" />

        <div className="space-y-0">
          {timeSlots.map((slot) => {
            const specials = slot.events.filter((e): e is SpecialEvent => e.type === 'special')
            const sessions = slot.events.filter((e): e is Session => e.type === 'session')

            return (
              <div key={`${slot.start}-${slot.end}`} className="flex gap-0 sm:gap-6 mb-6">
                {/* Time label */}
                <div className="hidden sm:flex flex-col items-end shrink-0 w-[4.5rem] pt-1">
                  <span className="text-sm font-semibold text-foreground">{slot.start}</span>
                  <span className="text-xs text-muted-foreground">{slot.end}</span>
                </div>

                {/* Dot on the timeline line */}
                <div className="hidden sm:flex items-start pt-2 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-background ring-1 ring-primary -ml-[5px] mt-0.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Mobile time label */}
                  <div className="sm:hidden mb-2 flex items-center gap-2">
                    <span className="text-sm font-semibold">{slot.start}</span>
                    <span className="text-xs text-muted-foreground">– {slot.end}</span>
                  </div>

                  {specials.map((e, i) => (
                    <div
                      key={i}
                      className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between mb-3"
                    >
                      <span className="font-medium text-sm">{e.name}</span>
                      <span className="text-sm text-muted-foreground sm:hidden">
                        {e.start}–{e.end}
                      </span>
                    </div>
                  ))}

                  {sessions.length > 0 && (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                      {sessions.map((session) => (
                        <SessionCard
                          key={session.session_id}
                          session={session}
                          showTime={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
