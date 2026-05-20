import type { Session } from '@/types'

export function buildCalendarUrls(
  date: string,
  session: Session,
  roomLabel: string,
): { google: string; outlook: string } {
  const dateCompact = date.replace(/-/g, '')
  const pad = (t: string) => t.padStart(5, '0')
  const toCompact = (t: string) => pad(t).replace(':', '') + '00'

  const description = session.presentations
    .map((p, i) => `${i + 1}. ${p.title} (${p.presenter})`)
    .join('\n')

  const google =
    'https://calendar.google.com/calendar/render?' +
    new URLSearchParams({
      action: 'TEMPLATE',
      text: session.name,
      dates: `${dateCompact}T${toCompact(session.start)}/${dateCompact}T${toCompact(session.end)}`,
      details: description,
      location: roomLabel,
    })

  const outlookParams = new URLSearchParams({
    subject: session.name,
    startdt: `${date}T${pad(session.start)}:00`,
    enddt: `${date}T${pad(session.end)}:00`,
    body: description,
    location: roomLabel,
  })

  const outlook = 'https://outlook.live.com/calendar/0/deeplink/compose?' + outlookParams
  const outlook365 = 'https://outlook.office.com/calendar/deeplink/compose?' + outlookParams

  return { google, outlook, outlook365 }
}
