import { Command as CommandPrimitive } from 'cmdk';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { cn } from '../lib/cn';
import { focusFeedback } from './focus-styles';
import { Popover } from './popover';
import { useComponentThemeStyle } from '../Theme/components-theme';

export type TagComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type TagComboboxProps = {
  options: readonly TagComboboxOption[];
  values?: readonly string[];
  value?: readonly string[];
  onValuesChange?: (values: string[]) => void;
  onValueChange?: (values: string[]) => void;
  onSearch?: (value: string) => void;
  onSearchChange?: (value: string) => void;
  allowCreate?: boolean;
  createLabel?: string;
  placeholder?: string;
  emptyText?: string;
  removeLabel?: (tag: string) => string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

const EMPTY_TAG_VALUES: readonly string[] = [];

function normalizedTag(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function TagCombobox({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  allowCreate = true,
  className,
  contentClassName,
  createLabel = 'Create',
  disabled = false,
  emptyText = 'No tags found.',
  id,
  onSearch,
  onSearchChange,
  onValueChange,
  onValuesChange,
  options,
  placeholder = 'Add a tag',
  removeLabel,
  style,
  value,
  values,
}: TagComboboxProps) {
  const componentStyle = useComponentThemeStyle(style);
  const selectedValues = values ?? value ?? EMPTY_TAG_VALUES;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputControlsId = useRef<string | undefined>(undefined);
  const labels = useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  );
  const selectedKeys = useMemo(() => new Set(selectedValues.map(normalizedTag)), [selectedValues]);
  const normalizedQuery = normalizedTag(query);
  const filteredOptions = options.filter(
    (option) =>
      !selectedKeys.has(normalizedTag(option.value)) &&
      (normalizedQuery.length === 0 ||
        normalizedTag(option.label).includes(normalizedQuery) ||
        normalizedTag(option.value).includes(normalizedQuery)),
  );
  const canCreate =
    allowCreate &&
    normalizedQuery.length > 0 &&
    !selectedKeys.has(normalizedQuery) &&
    !options.some(
      (option) =>
        normalizedTag(option.value) === normalizedQuery ||
        normalizedTag(option.label) === normalizedQuery,
    );

  const emitSearch = (nextQuery: string) => {
    setQuery(nextQuery);
    onSearch?.(nextQuery);
    onSearchChange?.(nextQuery);
  };

  const emitValues = (nextValues: string[]) => {
    onValuesChange?.(nextValues);
    onValueChange?.(nextValues);
  };

  const selectTag = (nextValue: string) => {
    if (!selectedKeys.has(normalizedTag(nextValue))) {
      emitValues([...selectedValues, nextValue]);
    }
    emitSearch('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeTag = (removedValue: string) => {
    emitValues(selectedValues.filter((selectedValue) => selectedValue !== removedValue));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && query.length === 0 && selectedValues.length > 0) {
      event.preventDefault();
      const lastValue = selectedValues[selectedValues.length - 1];
      if (lastValue !== undefined) removeTag(lastValue);
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') setOpen(true);
    if (event.key === 'Escape') setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) emitSearch('');
  };

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const controlsId = input.getAttribute('aria-controls');
    if (controlsId) inputControlsId.current = controlsId;

    input.setAttribute('aria-expanded', String(open));
    if (open && inputControlsId.current) {
      input.setAttribute('aria-controls', inputControlsId.current);
    } else {
      input.removeAttribute('aria-controls');
    }

    if (ariaLabelledBy) input.setAttribute('aria-labelledby', ariaLabelledBy);
  });

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <CommandPrimitive
        className="mfc:w-full mfc:overflow-visible mfc:bg-transparent"
        label={ariaLabel ?? placeholder}
        shouldFilter={false}
      >
        <Popover.Anchor asChild>
          <div
            className={cn(
              'mfc:flex mfc:min-h-8 mfc:w-full mfc:min-w-0 mfc:flex-wrap mfc:items-center mfc:gap-1 mfc:rounded-sm mfc:border mfc:border-input mfc:bg-background mfc:px-1.5 mfc:py-1 mfc:text-foreground mfc:outline-none mfc:transition-[color,box-shadow,border-color] mfc:data-[disabled=true]:pointer-events-none mfc:data-[disabled=true]:opacity-60',
              className,
            )}
            data-disabled={disabled}
            data-mf-component=""
            data-slot="tag-combobox"
            onClick={() => {
              inputRef.current?.focus();
              setOpen(true);
            }}
            ref={anchorRef}
            style={componentStyle}
          >
            {selectedValues.map((selectedValue) => {
              const label = labels.get(selectedValue) ?? selectedValue;

              return (
                <span
                  className="mfc:inline-flex mfc:h-5 mfc:max-w-full mfc:items-center mfc:gap-1 mfc:rounded mfc:bg-secondary mfc:px-1.5 mfc:text-xs mfc:text-secondary-foreground"
                  data-mf-component=""
                  data-slot="tag-combobox-tag"
                  key={selectedValue}
                >
                  <span className="mfc:truncate">{label}</span>
                  <button
                    aria-label={removeLabel?.(label) ?? `Remove ${label}`}
                    className={cn(
                      focusFeedback,
                      'mfc:rounded-sm mfc:text-muted-foreground mfc:outline-none mfc:hover:text-foreground',
                    )}
                    data-mf-component=""
                    data-slot="tag-combobox-remove"
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeTag(selectedValue);
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                  >
                    <XIcon className="mfc:size-3" aria-hidden="true" />
                  </button>
                </span>
              );
            })}
            <CommandPrimitive.Input
              className="mfc:h-5 mfc:min-w-20 mfc:flex-1 mfc:bg-transparent mfc:px-1 mfc:text-ui-control mfc:outline-none mfc:placeholder:text-muted-foreground"
              data-mf-component=""
              data-slot="tag-combobox-input"
              disabled={disabled}
              id={id}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              onValueChange={(nextQuery) => {
                emitSearch(nextQuery);
                setOpen(true);
              }}
              placeholder={selectedValues.length === 0 ? placeholder : undefined}
              ref={inputRef}
              value={query}
            />
          </div>
        </Popover.Anchor>
        <Popover.Content
          align="start"
          className={cn('mfc:w-[var(--radix-popover-trigger-width)] mfc:p-0', contentClassName)}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Node && anchorRef.current?.contains(target)) {
              event.preventDefault();
            }
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <CommandPrimitive.List
            className="mfc:max-h-56 mfc:overflow-x-hidden mfc:overflow-y-auto mfc:p-1"
            data-mf-component=""
            data-slot="tag-combobox-list"
          >
            {canCreate ? (
              <CommandPrimitive.Item
                className="mfc:flex mfc:min-h-7 mfc:cursor-default mfc:select-none mfc:items-center mfc:gap-2 mfc:rounded-sm mfc:px-2 mfc:py-1 mfc:text-ui-control mfc:outline-none mfc:data-[selected=true]:bg-primary-soft"
                data-mf-component=""
                data-slot="tag-combobox-create"
                onSelect={() => selectTag(query.trim())}
                value={`create:${query.trim()}`}
              >
                <PlusIcon className="mfc:size-3.5" aria-hidden="true" />
                <span>
                  {createLabel} “{query.trim()}”
                </span>
              </CommandPrimitive.Item>
            ) : null}
            {filteredOptions.map((option) => (
              <CommandPrimitive.Item
                className="mfc:flex mfc:min-h-7 mfc:cursor-default mfc:select-none mfc:items-center mfc:gap-2 mfc:rounded-sm mfc:px-2 mfc:py-1 mfc:text-ui-control mfc:outline-none mfc:data-[disabled=true]:pointer-events-none mfc:data-[disabled=true]:text-disabled-foreground mfc:data-[selected=true]:bg-primary-soft"
                data-mf-component=""
                data-slot="tag-combobox-item"
                disabled={option.disabled}
                key={option.value}
                onSelect={() => selectTag(option.value)}
                value={option.value}
              >
                <CheckIcon className="mfc:size-3.5 mfc:opacity-0" aria-hidden="true" />
                <span className="mfc:truncate">{option.label}</span>
              </CommandPrimitive.Item>
            ))}
            {!canCreate && filteredOptions.length === 0 ? (
              <CommandPrimitive.Empty
                className="mfc:px-3 mfc:py-4 mfc:text-center mfc:text-xs mfc:text-muted-foreground"
                data-mf-component=""
                data-slot="tag-combobox-empty"
              >
                {emptyText}
              </CommandPrimitive.Empty>
            ) : null}
          </CommandPrimitive.List>
        </Popover.Content>
      </CommandPrimitive>
    </Popover.Root>
  );
}
