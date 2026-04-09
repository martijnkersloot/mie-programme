import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import type { Presentation, PresentationType } from '@/types'
import { cn } from '@/lib/utils'
import PresenterLink from '@/components/PresenterLink'

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
}

export default function PresentationRow({ presentation, compact }: PresentationRowProps) {
  return (
    <div className={cn('border-t first:border-t-0', compact ? 'py-1.5' : 'py-2.5')}>
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
  )
}
