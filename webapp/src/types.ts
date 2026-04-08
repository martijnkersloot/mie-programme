export type PresentationType =
  | 'Full paper'
  | 'Short communication'
  | 'Workshop'
  | 'Panel'
  | 'Demo'

export interface Presentation {
  id: number
  type: PresentationType
  presenter: string
  title: string
}

export interface SpecialEvent {
  type: 'special'
  name: string
  start: string
  end: string
  room?: string
  room_name?: string
}

export interface Session {
  type: 'session'
  session_id: string
  name: string
  room: string
  room_name: string
  start: string
  end: string
  presentations: Presentation[]
}

export type Event = SpecialEvent | Session

export interface Day {
  date: string
  events: Event[]
}

export interface Programme {
  conference: string
  title: string
  days: Day[]
}
