import { HexColorInput, HexColorPicker } from 'react-colorful'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Popover } from '@/components/ui/popover'

const HEX_COLOR_PATTERN = /^#?([\da-f]{3}|[\da-f]{6})$/i

export function normalizeHexColor(value: string, fallback = '#000000') {
  const match = HEX_COLOR_PATTERN.exec(value.trim())
  if (!match) return fallback

  const hex = match[1]?.toLowerCase()
  if (!hex) return fallback
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((character) => `${character}${character}`)
      .join('')}`
  }

  return `#${hex}`
}

export type ColorPickerProps = {
  value: string
  onValueChange: (value: string) => void
  onValueCommit?: (value: string) => void
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  className?: string
  contentClassName?: string
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

export function ColorPicker({
  'aria-label': ariaLabel = 'Choose color',
  'aria-labelledby': ariaLabelledBy,
  className,
  contentClassName,
  disabled = false,
  id,
  onOpenChange,
  onValueChange,
  onValueCommit,
  value,
}: ColorPickerProps) {
  const externalColor = normalizeHexColor(value)
  const [color, setColor] = useState(externalColor)
  const latestColor = useRef(externalColor)
  const dirty = useRef(false)

  useEffect(() => {
    if (dirty.current || externalColor === latestColor.current) return

    latestColor.current = externalColor
    setColor(externalColor)
  }, [externalColor])

  const handleValueChange = (nextValue: string) => {
    const normalized = normalizeHexColor(nextValue, latestColor.current)
    dirty.current = true
    latestColor.current = normalized
    setColor(normalized)
    onValueChange(normalized)
  }

  const commit = () => {
    dirty.current = false
    onValueCommit?.(latestColor.current)
  }

  const handleValueCommit = (nextValue: string) => {
    const normalized = normalizeHexColor(nextValue, latestColor.current)
    latestColor.current = normalized
    setColor(normalized)
    commit()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) commit()
    onOpenChange?.(open)
  }

  return (
    <Popover.Root onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <Button
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn('justify-start gap-2 font-mono font-normal', className)}
          data-slot='color-picker-trigger'
          disabled={disabled}
          id={id}
          variant='outline'
        >
          <span
            className='size-4 shrink-0 rounded-sm border border-border shadow-sm'
            data-slot='color-picker-swatch'
            style={{ backgroundColor: color }}
          />
          <span>{color}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Content
        align='start'
        className={cn('w-auto space-y-2 p-3', contentClassName)}
      >
        <HexColorPicker
          color={color}
          onChange={handleValueChange}
          onChangeEnd={handleValueCommit}
        />
        <HexColorInput
          aria-label={`${ariaLabel} hex value`}
          className='h-8 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25'
          color={color}
          data-slot='color-picker-input'
          onBlur={commit}
          onChange={handleValueChange}
          prefixed
        />
      </Popover.Content>
    </Popover.Root>
  )
}
