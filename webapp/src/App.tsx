import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { ProgrammeContext } from './context'
import type { Programme } from './types'
import TimetablePage from './pages/TimetablePage'
import ListPage from './pages/ListPage'
import SearchPage from './pages/SearchPage'
import PresentersPage from './pages/PresentersPage'
import PresenterPage from './pages/PresenterPage'
import PresentationsPage from './pages/PresentationsPage'
import { Skeleton } from './components/ui/skeleton'
import { cn } from './lib/utils'
import { BookOpen, CalendarDays, List, Menu, Search, Users, X } from 'lucide-react'

const PROGRAMME_URL =
  'https://raw.githubusercontent.com/martijnkersloot/mie-programme/main/data/programme.json'

// ─── header ──────────────────────────────────────────────────────────────────

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    )

  const searchActive = location.pathname === '/search'

  return (
    <header className="border-b bg-background sticky top-0 z-20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-4">
          {/* Logo */}
          <NavLink to="/" className="shrink-0 font-bold text-primary text-base leading-none">
            MIE 2026
          </NavLink>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            <NavLink to="/list" className={({ isActive }) =>
              navLinkClass({ isActive: isActive || location.pathname.startsWith('/list') })
            }>
              <List className="h-3.5 w-3.5" />
              List
            </NavLink>
            <NavLink to="/timetable" className={navLinkClass}>
              <CalendarDays className="h-3.5 w-3.5" />
              Timetable
            </NavLink>
            <NavLink to="/presenters" className={navLinkClass}>
              <Users className="h-3.5 w-3.5" />
              Presenters
            </NavLink>
            <NavLink to="/presentations" className={navLinkClass}>
              <BookOpen className="h-3.5 w-3.5" />
              Presentations
            </NavLink>
          </nav>

          <div className="flex-1" />

          {/* Search icon (all screen sizes) */}
          <button
            onClick={() => navigate('/search')}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              searchActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav menu */}
        {mobileOpen && (
          <nav className="md:hidden border-t py-2 flex flex-col gap-1">
            <NavLink to="/list" className={({ isActive }) =>
              navLinkClass({ isActive: isActive || location.pathname.startsWith('/list') })
            }>
              <List className="h-4 w-4" />
              List
            </NavLink>
            <NavLink to="/timetable" className={navLinkClass}>
              <CalendarDays className="h-4 w-4" />
              Timetable
            </NavLink>
            <NavLink to="/presenters" className={navLinkClass}>
              <Users className="h-4 w-4" />
              Presenters
            </NavLink>
            <NavLink to="/presentations" className={navLinkClass}>
              <BookOpen className="h-4 w-4" />
              Presentations
            </NavLink>
          </nav>
        )}
      </div>
    </header>
  )
}

// ─── layout ──────────────────────────────────────────────────────────────────

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
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

// ─── app ─────────────────────────────────────────────────────────────────────

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
      <HashRouter>
        <Layout>
          {loading && <LoadingSkeleton />}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load programme: {error}
            </div>
          )}
          {!loading && !error && data && (
            <Routes>
              <Route path="/" element={<Navigate to="/list" replace />} />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/timetable/:date" element={<TimetablePage />} />
              <Route path="/list" element={<ListPage />} />
              <Route path="/list/:date" element={<ListPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/presenters" element={<PresentersPage />} />
              <Route path="/presenters/:name" element={<PresenterPage />} />
              <Route path="/presentations" element={<PresentationsPage />} />
              <Route path="*" element={<Navigate to="/list" replace />} />
            </Routes>
          )}
        </Layout>
      </HashRouter>
    </ProgrammeContext.Provider>
  )
}
