import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProgrammeContext } from './context'
import type { Programme } from './types'
import TimetablePage from './pages/TimetablePage'
import ListPage from './pages/ListPage'
import SearchPage from './pages/SearchPage'
import NavTabs from './components/NavTabs'
import { Skeleton } from './components/ui/skeleton'

const PROGRAMME_URL =
  'https://raw.githubusercontent.com/martijnkersloot/mie-programme/main/data/programme.json'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 pt-3">
          <h1 className="text-lg font-bold text-primary leading-none">MIE 2026</h1>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
            Opening the Personal Gate between Technology and Health Care
          </p>
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <NavTabs />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-lg" />
      ))}
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<Programme | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(PROGRAMME_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json: Programme) => setData(json))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load programme')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <ProgrammeContext.Provider value={{ data, loading, error }}>
      <BrowserRouter>
        <Layout>
          {loading && <LoadingSkeleton />}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load programme: {error}
            </div>
          )}
          {!loading && !error && data && (
            <Routes>
              <Route path="/" element={<Navigate to="/timetable" replace />} />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/timetable/:date" element={<TimetablePage />} />
              <Route path="/list" element={<ListPage />} />
              <Route path="/list/:date" element={<ListPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="*" element={<Navigate to="/timetable" replace />} />
            </Routes>
          )}
        </Layout>
      </BrowserRouter>
    </ProgrammeContext.Provider>
  )
}
