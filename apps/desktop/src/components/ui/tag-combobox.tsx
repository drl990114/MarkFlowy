import { Command as CommandPrimitive } from 'cmdk'
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { cn } from '@/lib/cn'
import { Popover } from '@/components/ui/popover'

export type TagComboboxOption = {
  value: string
  label: string
  disabled?: boolean
}

export type TagComboboxProps = {
  options: readonly TagComboboxOption[]
  values?: readonly string[]
  value?: readonly string[]
  onValuesChange?: (values: string[]) => void
  onValueChange?: (values: string[]) => void
  onSearch?: (value: string) => void
  onSearchChange?: (value: string) => void
  allowCreate?: boolean
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  style?: CSSProperties
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

const EMPTY_TAG_VALUES: readonly string[] = []

function normalizedTag(value: string) {
  return value.trim().toLocaleLowerCase()
}

export function TagCombobox({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  allowCreate = true,
  className,
  contentClassName,
  disabled = false,
  emptyText = 'No tags found.',
  id,
  onSearch,
  onSearchChange,
  onValueChange,
  onValuesChange,
  options,
  placeholder = 'Add a tag',
  style,
  value,
  values,
}: TagComboboxProps) {
  const selectedValues = values ?? value ?? EMPTY_TAG_VALUES
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputControlsId = useRef<string | undefined>(undefined)
  const labels = useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  )
  const selectedKeys = useMemo(
    () => new Set(selectedValues.map(normalizedTag)),
    [selectedValues],
  )
  const normalizedQuery = normalizedTag(query)
  const filteredOptions = options.filter(
    (option) =>
      !selectedKeys.has(normalizedTag(option.value)) &&
      (normalizedQuery.length === 0 ||
        normalizedTag(option.label).includes(normalizedQuery) ||
        normalizedTag(option.value).includes(normalizedQuery)),
  )
  const canCreate =
    allowCreate &&
    normalizedQuery.length > 0 &&
    !selectedKeys.has(normalizedQuery) &&
    !options.some(
      (option) =>
        normalizedTag(option.value) === normalizedQuery ||
        normalizedTag(option.label) === normalizedQuery,
    )

  const emitSearch = (nextQuery: string) => {
    setQuery(nextQuery)
    onSearch?.(nextQuery)
    onSearchChange?.(nextQuery)
  }

  const emitValues = (nextValues: string[]) => {
    onValuesChange?.(nextValues)
    onValueChange?.(nextValues)
  }

  const selectTag = (nextValue: string) => {
    if (!selectedKeys.has(normalizedTag(nextValue))) {
      emitValues([...selectedValues, nextValue])
    }
    emitSearch('')
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const removeTag = (removedValue: string) => {
    emitValues(selectedValues.filter((selectedValue) => selectedValue !== removedValue))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && query.length === 0 && selectedValues.length > 0) {
      event.preventDefault()
      const lastValue = selectedValues[selectedValues.length - 1]
      if (lastValue !== undefined) removeTag(lastValue)
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') setOpen(true)
    if (event.key === 'Escape') setOpen(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) emitSearch('')
  }

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return

    const controlsId = input.getAttribute('aria-controls')
    if (controlsId) inputControlsId.current = controlsId

    input.setAttribute('aria-expanded', String(open))
    if (open && inputControlsId.current) {
      input.setAttribute('aria-controls', inputControlsId.current)
    } else {
      input.removeAttribute('aria-controls')
    }

    if (ariaLabelledBy) input.setAttribute('aria-labelledby', ariaLabelledBy)
  })

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <CommandPrimitive
        className='w-full overflow-visible bg-transparent'
        label={ariaLabel ?? placeholder}
        shouldFilter={false}
      >
        <Popover.Anchor asChild>
          <div
            className={cn(
              'flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1 text-foreground shadow-sm outline-none transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-60',
              className,
            )}
            data-disabled={disabled}
            data-slot='tag-combobox'
            onClick={() => {
              inputRef.current?.focus()
              setOpen(true)
            }}
            ref={anchorRef}
            style={style}
          >
            {selectedValues.map((selectedValue) => {
              const label = labels.get(selectedValue) ?? selectedValue

              return (
                <span
                  className='inline-flex h-5 max-w-full items-center gap-1 rounded bg-secondary px-1.5 text-xs text-secondary-foreground'
                  data-slot='tag-combobox-tag'
                  key={selectedValue}
                >
                  <span className='truncate'>{label}</span>
                  <button
                    aria-label={`Remove ${label}`}
                    className='rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring'
                    data-slot='tag-combobox-remove'
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation()
                      removeTag(selectedValue)
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    type='button'
                  >
                    <XIcon className='size-3' aria-hidden='true' />
                  </button>
                </span>
              )
            })}
            <CommandPrimitive.Input
              className='h-5 min-w-20 flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground'
              data-slot='tag-combobox-input'
              disabled={disabled}
              id={id}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              onValueChange={(nextQuery) => {
                emitSearch(nextQuery)
                setOpen(true)
              }}
              placeholder={selectedValues.length === 0 ? placeholder : undefined}
              ref={inputRef}
              value={query}
            />
          </div>
        </Popover.Anchor>
        <Popover.Content
          align='start'
          className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
          onInteractOutside={(event) => {
            const target = event.target
            if (target instanceof Node && anchorRef.current?.contains(target)) {
              event.preventDefault()
            }
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <CommandPrimitive.List
            className='max-h-56 overflow-x-hidden overflow-y-auto p-1'
            data-slot='tag-combobox-list'
          >
            {canCreate ? (
              <CommandPrimitive.Item
                className='flex min-h-7 cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[selected=true]:bg-primary-soft'
                data-slot='tag-combobox-create'
                onSelect={() => selectTag(query.trim())}
                value={`create:${query.trim()}`}
              >
                <PlusIcon className='size-3.5' aria-hidden='true' />
                <span>Create “{query.trim()}”</span>
              </CommandPrimitive.Item>
            ) : null}
            {filteredOptions.map((option) => (
              <CommandPrimitive.Item
                className='flex min-h-7 cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:text-disabled-foreground data-[selected=true]:bg-primary-soft'
                data-slot='tag-combobox-item'
                disabled={option.disabled}
                key={option.value}
                onSelect={() => selectTag(option.value)}
                value={option.value}
              >
                <CheckIcon className='size-3.5 opacity-0' aria-hidden='true' />
                <span className='truncate'>{option.label}</span>
              </CommandPrimitive.Item>
            ))}
            {!canCreate && filteredOptions.length === 0 ? (
              <CommandPrimitive.Empty
                className='px-3 py-4 text-center text-xs text-muted-foreground'
                data-slot='tag-combobox-empty'
              >
                {emptyText}
              </CommandPrimitive.Empty>
            ) : null}
          </CommandPrimitive.List>
        </Popover.Content>
      </CommandPrimitive>
    </Popover.Root>
  )
}
