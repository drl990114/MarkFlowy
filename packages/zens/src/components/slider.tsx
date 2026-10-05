import { useComponentThemeStyle } from '../Theme/components-theme';
import { Slider as SliderPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { compactControlFocus } from './focus-styles';

type SliderPrimitiveProps = ComponentProps<typeof SliderPrimitive.Root>;

export type SliderProps = Omit<
  SliderPrimitiveProps,
  'defaultValue' | 'onValueChange' | 'onValueCommit' | 'value'
> & {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
};

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
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SliderPrimitive.Root
      className={cn(
        'mfc:relative mfc:flex mfc:min-h-7 mfc:w-full mfc:touch-none mfc:items-center mfc:select-none mfc:data-[disabled]:opacity-50 mfc:data-[orientation=vertical]:h-full mfc:data-[orientation=vertical]:min-h-24 mfc:data-[orientation=vertical]:min-w-7 mfc:data-[orientation=vertical]:w-auto mfc:data-[orientation=vertical]:flex-col',
        className,
      )}
      data-mf-component=""
      data-slot="slider"
      defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
      max={max}
      min={min}
      onValueChange={(values) => onValueChange?.(values[0] ?? min)}
      onValueCommit={(values) => onValueCommit?.(values[0] ?? min)}
      value={value === undefined ? undefined : [value]}
      {...props}
      style={componentStyle}
    >
      <SliderPrimitive.Track
        className="mfc:relative mfc:h-1 mfc:w-full mfc:grow mfc:overflow-hidden mfc:rounded-full mfc:bg-muted mfc:data-[orientation=vertical]:h-full mfc:data-[orientation=vertical]:w-1"
        data-mf-component=""
        data-slot="slider-track"
      >
        <SliderPrimitive.Range
          className="mfc:absolute mfc:h-full mfc:bg-primary mfc:data-[orientation=vertical]:w-full"
          data-mf-component=""
          data-slot="slider-range"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText}
        className={cn(
          compactControlFocus,
          'mfc:block mfc:size-4 mfc:shrink-0 mfc:rounded-full mfc:border mfc:border-control-border mfc:bg-surface-elevated mfc:shadow-sm mfc:dark:bg-content-primary mfc:disabled:pointer-events-none mfc:disabled:opacity-50',
        )}
        data-mf-component=""
        data-slot="slider-thumb"
      />
    </SliderPrimitive.Root>
  );
}

export type RangeSliderProps = Omit<
  SliderPrimitiveProps,
  'defaultValue' | 'onValueChange' | 'onValueCommit' | 'value'
> & {
  defaultValue?: [number, number];
  value?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  onValueCommit?: (value: [number, number]) => void;
  ariaValueText?: [string, string];
};

function toRange(values: number[], fallback: number): [number, number] {
  return [values[0] ?? fallback, values[1] ?? values[0] ?? fallback];
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
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SliderPrimitive.Root
      className={cn(
        'mfc:relative mfc:flex mfc:min-h-7 mfc:w-full mfc:touch-none mfc:items-center mfc:select-none mfc:data-[disabled]:opacity-50 mfc:data-[orientation=vertical]:h-full mfc:data-[orientation=vertical]:min-h-24 mfc:data-[orientation=vertical]:min-w-7 mfc:data-[orientation=vertical]:w-auto mfc:data-[orientation=vertical]:flex-col',
        className,
      )}
      data-mf-component=""
      data-slot="range-slider"
      defaultValue={defaultValue ?? [min, max]}
      max={max}
      min={min}
      onValueChange={(values) => onValueChange?.(toRange(values, min))}
      onValueCommit={(values) => onValueCommit?.(toRange(values, min))}
      value={value}
      {...props}
      style={componentStyle}
    >
      <SliderPrimitive.Track
        className="mfc:relative mfc:h-1 mfc:w-full mfc:grow mfc:overflow-hidden mfc:rounded-full mfc:bg-muted mfc:data-[orientation=vertical]:h-full mfc:data-[orientation=vertical]:w-1"
        data-mf-component=""
        data-slot="range-slider-track"
      >
        <SliderPrimitive.Range
          className="mfc:absolute mfc:h-full mfc:bg-primary mfc:data-[orientation=vertical]:w-full"
          data-mf-component=""
          data-slot="range-slider-range"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel ? `${ariaLabel} minimum` : undefined}
        aria-valuetext={ariaValueText?.[0]}
        className={cn(
          compactControlFocus,
          'mfc:block mfc:size-4 mfc:shrink-0 mfc:rounded-full mfc:border mfc:border-control-border mfc:bg-surface-elevated mfc:shadow-sm mfc:dark:bg-content-primary mfc:disabled:pointer-events-none mfc:disabled:opacity-50',
        )}
        data-mf-component=""
        data-slot="range-slider-thumb"
      />
      <SliderPrimitive.Thumb
        aria-label={ariaLabel ? `${ariaLabel} maximum` : undefined}
        aria-valuetext={ariaValueText?.[1]}
        className={cn(
          compactControlFocus,
          'mfc:block mfc:size-4 mfc:shrink-0 mfc:rounded-full mfc:border mfc:border-control-border mfc:bg-surface-elevated mfc:shadow-sm mfc:dark:bg-content-primary mfc:disabled:pointer-events-none mfc:disabled:opacity-50',
        )}
        data-mf-component=""
        data-slot="range-slider-thumb"
      />
    </SliderPrimitive.Root>
  );
}
