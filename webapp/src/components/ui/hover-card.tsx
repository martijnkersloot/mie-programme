import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { cn } from '@/lib/utils'

const HoverCard = HoverCardPrimitive.Root
const HoverCardTrigger = HoverCardPrimitive.Trigger

function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[300] w-56 rounded-md border bg-background p-3 text-foreground shadow-md',
          'transition-opacity duration-150 data-[state=open]:opacity-100 data-[state=closed]:opacity-0',
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}

export { HoverCard, HoverCardTrigger, HoverCardContent }
