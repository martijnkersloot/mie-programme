import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { ProgrammeContext } from './context'
import type { Programme } from './types'
import TimetablePage from './pages/TimetablePage'
import ListPage from './pages/ListPage'
import SearchPage from './pages/SearchPage'
import { Skeleton } from './components/ui/skeleton'
import { Input } from './components/ui/input'
import { cn } from './lib/utils'
import { CalendarDays, List, Menu, Search, X } from 'lucide-react'

const PROGRAMME_URL =
  'https://raw.githubusercontent.com/martijnkersloot/mie-programme/main/data/programme.json'

// ─── header ──────────────────────────────────────────────────────────────────

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
    setMobileSearchOpen(false)
  }, [location.pathname])

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    navigate(`/search?q=${encodeURIComponent(value)}`, { replace: location.pathname === '/search' })
  }

  const handleSearchSubmit = (e: React.FormEvent) => e.preventDefault()

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    )

  return (
    <header className="border-b bg-background sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        {/* Main row */}
        <div className="flex items-center h-14 gap-4">
          {/* Logo */}
          <NavLink to="/" className="shrink-0 font-bold text-primary text-base leading-none">
            MIE 2026
          </NavLink>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            <NavLink to="/timetable" className={navLinkClass}>
              <CalendarDays className="h-3.5 w-3.5" />
              Timetable
            </NavLink>
            <NavLink
              to="/list"
              className={({ isActive }) =>
                navLinkClass({ isActive: isActive || location.pathname.startsWith('/list') })
              }
            >
              <List className="h-3.5 w-3.5" />
              List
            </NavLink>
          </nav>

          <div className="flex-1" />

          {/* Desktop search */}
          <form onSubmit={handleSearchSubmit} className="hidden md:block">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search sessions…"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 w-56 h-9 text-sm"
              />
            </div>
          </form>

          {/* Mobile: search + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => { setMobileSearchOpen((v) => !v); setMobileOpen(false) }}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={() => { setMobileOpen((v) => !v); setMobileSearchOpen(false) }}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        {mobileSearchOpen && (
          <div className="md:hidden pb-3">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  autoFocus
                  placeholder="Search sessions…"
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </form>
          </div>
        )}

        {/* Mobile nav menu */}
        {mobileOpen && (
          <nav className="md:hidden border-t py-2 flex flex-col gap-1">
            <NavLink to="/timetable" className={navLinkClass}>
              <CalendarDays className="h-4 w-4" />
              Timetable
            </NavLink>
            <NavLink
              to="/list"
              className={({ isActive }) =>
                navLinkClass({ isActive: isActive || location.pathname.startsWith('/list') })
              }
            >
              <List className="h-4 w-4" />
              List
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
