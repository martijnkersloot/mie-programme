import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import type { Presentation, PresentationType } from '@/types'
import { cn } from '@/lib/utils'
import PresenterLink from '@/components/PresenterLink'
import { Star } from 'lucide-react'

function typeBadgeVariant(type: PresentationType): BadgeProps['variant'] {
  switch (type) {
    case 'Full paper':         return 'blue'
    case 'Short communication': return 'secondary'
    case 'Workshop':           return 'yellow'
    case 'Panel':              return 'purple'
    case 'Demo':               return 'green'
  }
}

interface PresentationRowProps {
  presentation: Presentation
  compact?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (id: number) => void
}

export default function PresentationRow({ presentation, compact, isFavorite, onToggleFavorite }: PresentationRowProps) {
  return (
    <div className={cn('border-t first:border-t-0 flex items-start gap-2', compact ? 'py-1.5' : 'py-2.5')}>
      <div className="min-w-0 flex-1">
        <Badge
          variant={typeBadgeVariant(presentation.type)}
          className="text-[10px] px-1.5 py-0 mb-1 font-medium"
        >
          {presentation.type}
        </Badge>
        <p className={cn('font-medium leading-snug', compact ? 'text-xs' : 'text-sm')}>
          {presentation.title}
        </p>
        <PresenterLink
          name={presentation.presenter}
          className={cn('text-muted-foreground mt-0.5 block', compact ? 'text-[10px]' : 'text-xs')}
        />
      </div>
      {onToggleFavorite && (
        <button
          onClick={() => onToggleFavorite(presentation.id)}
          className={cn(
            'shrink-0 p-1 rounded-md transition-colors mt-0.5',
            isFavorite
              ? 'text-amber-500 hover:text-amber-600'
              : 'text-muted-foreground hover:text-amber-500'
          )}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-current')} />
        </button>
      )}
    </div>
  )
}
