import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PresentationType } from '@/types'

export type TypeFilter = PresentationType | 'all'

interface FilterBarProps {
  query: string
  onQueryChange: (q: string) => void
  typeFilter: TypeFilter
  onTypeFilterChange: (t: TypeFilter) => void
  resultCount: number
}

const TYPES: PresentationType[] = [
  'Full paper',
  'Short communication',
  'Workshop',
  'Panel',
  'Demo',
]

export default function FilterBar({
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  resultCount,
}: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title or presenter…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-8"
        />
      </div>
      <Select value={typeFilter} onValueChange={(v) => onTypeFilterChange(v as TypeFilter)}>
        <SelectTrigger className="sm:w-52">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(query || typeFilter !== 'all') && (
        <p className="text-sm text-muted-foreground self-center shrink-0">
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
