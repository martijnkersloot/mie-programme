import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { CalendarDays, List, Search } from 'lucide-react'

const TABS = [
  { path: '/timetable', label: 'Timetable', icon: CalendarDays },
  { path: '/list', label: 'List', icon: List },
  { path: '/search', label: 'Search', icon: Search },
]

export default function NavTabs() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex gap-0 -mb-px">
      {TABS.map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
