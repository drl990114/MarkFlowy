import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useCallback, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover } from '@/components/ui/popover'

export type SearchableSelectOption = {
  value: string
  label: string
  disabled?: boolean
  keywords?: readonly string[]
}

export type SearchableSelectProps = {
  value?: string
  options: readonly SearchableSelectOption[]
  onValueChange: (value: string) => void
  onSearch?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  style?: CSSProperties
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

export function SearchableSelect({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  className,
  contentClassName,
  disabled = false,
  emptyText = 'No results found.',
  id,
  onSearch,
  onValueChange,
  options,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search…',
  style,
  value,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const selectedOption = options.find((option) => option.value === value)
  const setTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    setPortalContainer(node?.closest<HTMLElement>('[data-slot="dialog-content"]') ?? null)
  }, [])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-haspopup='listbox' asChild>
        <Button
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
          data-slot='searchable-select-trigger'
          disabled={disabled}
          id={id}
          ref={setTriggerRef}
          role='combobox'
          style={style}
          variant='outline'
        >
          <span className={cn('truncate', !selectedOption && !value && 'text-muted-foreground')}>
            {selectedOption?.label ?? (value || placeholder)}
          </span>
          <ChevronsUpDownIcon className='size-3.5 opacity-60' aria-hidden='true' />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        align='start'
        className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
        container={portalContainer ?? undefined}
      >
        <Command.Root defaultValue={value} label={searchPlaceholder}>
          <CommandInput onValueChange={onSearch} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                disabled={option.disabled}
                key={option.value}
                keywords={[option.label, ...(option.keywords ?? [])]}
                onSelect={() => {
                  onValueChange(option.value)
                  onSearch?.('')
                  setOpen(false)
                }}
                value={option.value}
              >
                <CheckIcon
                  className={cn('mr-2 size-3.5', value === option.value ? 'opacity-100' : 'opacity-0')}
                  aria-hidden='true'
                />
                <span className='truncate'>{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  )
}
