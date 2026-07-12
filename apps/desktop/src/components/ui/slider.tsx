import { Slider as SliderPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type SliderPrimitiveProps = ComponentProps<typeof SliderPrimitive.Root>

export type SliderProps = Omit<
  SliderPrimitiveProps,
  'defaultValue' | 'onValueChange' | 'onValueCommit' | 'value'
> & {
  defaultValue?: number
  value?: number
  onValueChange?: (value: number) => void
  onValueCommit?: (value: number) => void
}

export function Slider({
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
  className,
  defaultValue,
  max = 100,
  min = 0,
  onValueChange,
  onValueCommit,
  value,
  ...props
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-24 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      data-slot='slider'
      defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
      max={max}
      min={min}
      onValueChange={(values) => onValueChange?.(values[0] ?? min)}
      onValueCommit={(values) => onValueCommit?.(values[0] ?? min)}
      value={value === undefined ? undefined : [value]}
      {...props}
    >
      <SliderPrimitive.Track
        className='relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
        data-slot='slider-track'
      >
        <SliderPrimitive.Range
          className='absolute h-full bg-primary data-[orientation=vertical]:w-full'
          data-slot='slider-range'
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText}
        className='block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50'
        data-slot='slider-thumb'
      />
    </SliderPrimitive.Root>
  )
}

export type RangeSliderProps = Omit<
  SliderPrimitiveProps,
  'defaultValue' | 'onValueChange' | 'onValueCommit' | 'value'
> & {
  defaultValue?: [number, number]
  value?: [number, number]
  onValueChange?: (value: [number, number]) => void
  onValueCommit?: (value: [number, number]) => void
  ariaValueText?: [string, string]
}

function toRange(values: number[], fallback: number): [number, number] {
  return [values[0] ?? fallback, values[1] ?? values[0] ?? fallback]
}

export function RangeSlider({
  'aria-label': ariaLabel,
  ariaValueText,
  className,
  defaultValue,
  max = 100,
  min = 0,
  onValueChange,
  onValueCommit,
  value,
  ...props
}: RangeSliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-24 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      data-slot='range-slider'
      defaultValue={defaultValue ?? [min, max]}
      max={max}
      min={min}
      onValueChange={(values) => onValueChange?.(toRange(values, min))}
      onValueCommit={(values) => onValueCommit?.(toRange(values, min))}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track
        className='relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
        data-slot='range-slider-track'
      >
        <SliderPrimitive.Range
          className='absolute h-full bg-primary data-[orientation=vertical]:w-full'
          data-slot='range-slider-range'
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel ? `${ariaLabel} minimum` : undefined}
        aria-valuetext={ariaValueText?.[0]}
        className='block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50'
        data-slot='range-slider-thumb'
      />
      <SliderPrimitive.Thumb
        aria-label={ariaLabel ? `${ariaLabel} maximum` : undefined}
        aria-valuetext={ariaValueText?.[1]}
        className='block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50'
        data-slot='range-slider-thumb'
      />
    </SliderPrimitive.Root>
  )
}
