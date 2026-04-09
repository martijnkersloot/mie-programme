import { useState, useRef, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
  sublabel?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'All',
  searchPlaceholder = 'Search…',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setSearch('')
  }, [open])

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.sublabel?.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} selected`

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'hover:bg-muted/50 transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
            className
          )}
        >
          <span className={cn('truncate', value.length === 0 && 'text-muted-foreground')}>
            {triggerLabel}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value.length > 0 && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onChange([]) }}
                className="rounded-sm hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-[200] w-72 rounded-md border bg-background shadow-lg"
          sideOffset={4}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Search */}
          <div className="border-b p-2">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">No results</p>
            )}
            {filtered.map((o) => {
              const selected = value.includes(o.value)
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted transition-colors"
                >
                  <div className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                    selected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                  )}>
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug truncate">{o.label}</p>
                    {o.sublabel && (
                      <p className="text-xs text-muted-foreground truncate">{o.sublabel}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          {value.length > 0 && (
            <div className="border-t p-2 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{value.length} selected</span>
              <button
                onClick={() => onChange([])}
                className="text-xs text-primary hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
