import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useProgramme } from '@/context'
import { formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'

export default function DayTabs() {
  const { data } = useProgramme()
  const { date } = useParams<{ date: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const isSearch = location.pathname === '/search'

  return (
    <div className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
      {data?.days.map((day) => {
        const isActive = !isSearch && day.date === date
        return (
          <button
            key={day.date}
            onClick={() => navigate(`/day/${day.date}`)}
            className={cn(
              'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            )}
          >
            {formatDateShort(day.date)}
          </button>
        )
      })}

      {/* Separator */}
      <div className="w-px bg-border mx-2 my-2 shrink-0" />

      <button
        onClick={() => navigate('/search')}
        className={cn(
          'flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0',
          isSearch
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
        )}
      >
        <Search className="h-3.5 w-3.5" />
        Search
      </button>
    </div>
  )
}
