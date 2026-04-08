import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import type { Presentation, PresentationType } from '@/types'
import { cn } from '@/lib/utils'

function typeBadgeVariant(type: PresentationType): BadgeProps['variant'] {
  switch (type) {
    case 'Full paper':
      return 'blue'
    case 'Short communication':
      return 'secondary'
    case 'Workshop':
      return 'yellow'
    case 'Panel':
      return 'purple'
    case 'Demo':
      return 'green'
  }
}

interface PresentationRowProps {
  presentation: Presentation
  /** Smaller text for use inside timetable cells */
  compact?: boolean
}

export default function PresentationRow({ presentation, compact }: PresentationRowProps) {
  return (
    <div className={cn('flex items-start gap-2 border-t first:border-t-0', compact ? 'py-1.5' : 'py-2 gap-3')}>
      <Badge
        variant={typeBadgeVariant(presentation.type)}
        className={cn('mt-0.5 shrink-0', compact && 'text-[10px] px-1.5 py-0')}
      >
        {presentation.type}
      </Badge>
      <div className="min-w-0">
        <p className={cn('font-medium leading-snug', compact ? 'text-xs' : 'text-sm')}>
          {presentation.title}
        </p>
        <p className={cn('text-muted-foreground mt-0.5', compact ? 'text-[10px]' : 'text-xs')}>
          {presentation.presenter}
        </p>
      </div>
    </div>
  )
}
