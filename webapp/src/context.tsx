import { createContext, useContext } from 'react'
import type { Programme } from './types'

interface ProgrammeContextValue {
  data: Programme | null
  loading: boolean
  error: string | null
}

export const ProgrammeContext = createContext<ProgrammeContextValue>({
  data: null,
  loading: true,
  error: null,
})

export function useProgramme() {
  return useContext(ProgrammeContext)
}
