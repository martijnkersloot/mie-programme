import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import type { Presentation, PresentationType } from '@/types'

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
}

export default function PresentationRow({ presentation }: PresentationRowProps) {
  return (
    <div className="flex items-start gap-3 py-2 border-t first:border-t-0">
      <Badge variant={typeBadgeVariant(presentation.type)} className="mt-0.5 shrink-0">
        {presentation.type}
      </Badge>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{presentation.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{presentation.presenter}</p>
      </div>
    </div>
  )
}
