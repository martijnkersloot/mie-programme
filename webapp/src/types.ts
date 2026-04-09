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

export interface Room {
  id: string
  label: string
  nickname: string
}

export interface SpecialEvent {
  type: 'special'
  name: string
  room_id: string
  start: string
  end: string
}

export interface Session {
  type: 'session'
  session_id: string
  name: string
  room_id: string
  start: string
  end: string
  presentations: Presentation[]
}

export type Event = SpecialEvent | Session

export interface Day {
  date: string
  events: Event[]
}

export interface Meta {
  imported_at: string
  source_filename: string
  source_file_modified: string
}

export interface Programme {
  conference: string
  title: string
  rooms: Room[]
  days: Day[]
  meta?: Meta
}
