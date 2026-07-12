import { useAui } from '@assistant-ui/react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type ModelOption = {
  id: string
  name: string
  description?: string
  icon?: ReactNode
  disabled?: boolean
  keywords?: readonly string[]
}

type ModelSelectorContextValue = {
  models: readonly ModelOption[]
  value: string | undefined
  selectedModel: ModelOption | undefined
  setValue: (value: string) => void
  setOpen: (open: boolean) => void
}

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(null)

function useModelSelectorContext(): ModelSelectorContextValue {
  const context = useContext(ModelSelectorContext)
  if (!context) throw new Error('ModelSelector components must be used within ModelSelector.Root')
  return context
}

function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value: T | undefined
  defaultValue: T
  onChange?: (value: T) => void
}) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const controlled = value !== undefined
  const currentValue = controlled ? value : internalValue
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  const setValue = useCallback(
    (nextValue: T) => {
      if (!controlled) setInternalValue(nextValue)
      onChangeRef.current?.(nextValue)
    },
    [controlled],
  )

  return [currentValue, setValue] as const
}

export type ModelSelectorRootProps = {
  models: readonly ModelOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

function ModelSelectorModelContext() {
  const { value } = useModelSelectorContext()
  const api = useAui()

  useEffect(() => {
    if (!value) return undefined

    return api.modelContext().register({
      getModelContext: () => ({ config: { modelName: value } }),
    })
  }, [api, value])

  return null
}

function ModelSelectorRoot({
  models,
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: ModelSelectorRootProps) {
  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue: defaultValue ?? models[0]?.id ?? '',
    onChange: onValueChange,
  })
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const selectedModel = useMemo(() => models.find((model) => model.id === value), [models, value])
  const context = useMemo(
    () => ({ models, value: value || undefined, selectedModel, setValue, setOpen }),
    [models, selectedModel, setOpen, setValue, value],
  )

  return (
    <ModelSelectorContext.Provider value={context}>
      <Popover onOpenChange={setOpen} open={open}>
        <ModelSelectorModelContext />
        {children}
      </Popover>
    </ModelSelectorContext.Provider>
  )
}

export const modelSelectorTriggerVariants = cva(
  'flex w-fit items-center justify-between gap-1.5 overflow-hidden rounded-md text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-disabled-foreground disabled:opacity-60 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        muted: 'bg-secondary text-secondary-foreground hover:bg-accent',
      },
      size: {
        default: 'h-8 px-2.5',
        sm: 'h-7 px-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'default',
    },
  },
)

export type ModelSelectorTriggerProps = ComponentPropsWithoutRef<typeof PopoverTrigger> &
  VariantProps<typeof modelSelectorTriggerVariants>

function ModelSelectorTrigger({
  className,
  variant,
  size,
  children,
  ...props
}: ModelSelectorTriggerProps) {
  return (
    <PopoverTrigger
      aria-haspopup='listbox'
      className={cn(modelSelectorTriggerVariants({ variant, size }), className)}
      data-slot='model-selector-trigger'
      role='combobox'
      {...props}
    >
      {children ?? <ModelSelectorValue />}
      <ChevronDownIcon className='size-3.5 opacity-60' />
    </PopoverTrigger>
  )
}

export type ModelSelectorValueProps = {
  className?: string
  placeholder?: ReactNode
}

function ModelSelectorValue({ className, placeholder = 'Select model' }: ModelSelectorValueProps) {
  const { selectedModel } = useModelSelectorContext()

  if (!selectedModel)
    return <span className={cn('text-muted-foreground', className)}>{placeholder}</span>

  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      {selectedModel.icon ? (
        <span className='flex size-3.5 shrink-0 items-center'>{selectedModel.icon}</span>
      ) : null}
      <span className='truncate font-medium'>{selectedModel.name}</span>
    </span>
  )
}

export type ModelSelectorContentProps = ComponentPropsWithoutRef<typeof PopoverContent>

function ModelSelectorContent({
  className,
  align = 'start',
  children,
  ...props
}: ModelSelectorContentProps) {
  const { value } = useModelSelectorContext()

  return (
    <PopoverContent
      align={align}
      className={cn(
        'aui-popover-content w-72 min-w-[var(--radix-popover-trigger-width)] overflow-hidden p-0',
        className,
      )}
      {...props}
    >
      <Command defaultValue={value} label='Search models'>
        {children}
      </Command>
    </PopoverContent>
  )
}

export type ModelSelectorSearchProps = ComponentPropsWithoutRef<typeof CommandInput>

function ModelSelectorSearch({
  placeholder = 'Search models…',
  ...props
}: ModelSelectorSearchProps) {
  return <CommandInput aria-label={placeholder} placeholder={placeholder} {...props} />
}

function ModelSelectorList({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof CommandList>) {
  const { models } = useModelSelectorContext()

  return (
    <CommandList className={cn('aui-command-list', className)} {...props}>
      {children ?? (
        <>
          <ModelSelectorEmpty />
          <ModelSelectorGroup>
            {models.map((model) => (
              <ModelSelectorItem key={model.id} model={model} />
            ))}
          </ModelSelectorGroup>
        </>
      )}
    </CommandList>
  )
}

function ModelSelectorEmpty({ children, ...props }: ComponentPropsWithoutRef<typeof CommandEmpty>) {
  return <CommandEmpty {...props}>{children ?? 'No models found.'}</CommandEmpty>
}

function ModelSelectorGroup(props: ComponentPropsWithoutRef<typeof CommandGroup>) {
  return <CommandGroup data-slot='model-selector-group' {...props} />
}

function ModelSelectorSeparator(props: ComponentPropsWithoutRef<typeof CommandSeparator>) {
  return <CommandSeparator {...props} />
}

export type ModelSelectorItemProps = Omit<ComponentPropsWithoutRef<typeof CommandItem>, 'value'> & {
  model: ModelOption
}

function ModelSelectorItem({
  model,
  className,
  children,
  onSelect,
  ...props
}: ModelSelectorItemProps) {
  const { value, setValue, setOpen } = useModelSelectorContext()
  const selected = value === model.id

  return (
    <CommandItem
      className={cn('items-center gap-1.5 pe-7', className)}
      disabled={model.disabled}
      keywords={[model.name, ...(model.keywords ?? [])]}
      onSelect={(selectedValue) => {
        setValue(model.id)
        setOpen(false)
        onSelect?.(selectedValue)
      }}
      value={model.id}
      {...props}
    >
      {children ?? (
        <>
          {model.icon ? (
            <span className='flex size-3.5 shrink-0 items-center'>{model.icon}</span>
          ) : null}
          <span className='flex min-w-0 flex-col'>
            <span className='truncate font-medium'>{model.name}</span>
            {model.description ? (
              <span className='truncate text-xs text-muted-foreground'>{model.description}</span>
            ) : null}
          </span>
        </>
      )}
      {selected ? <CheckIcon className='absolute end-2 top-1/2 size-3.5 -translate-y-1/2' /> : null}
    </CommandItem>
  )
}

function ModelSelectorFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('border-t border-border p-1', className)}
      data-slot='model-selector-footer'
      {...props}
    />
  )
}

export type ModelSelectorProps = Omit<ModelSelectorRootProps, 'children'> &
  VariantProps<typeof modelSelectorTriggerVariants> & {
    align?: ModelSelectorContentProps['align']
    className?: string
    contentClassName?: string
    searchPlaceholder?: string
  }

const ModelSelectorConvenience = memo(function ModelSelectorConvenience({
  align,
  className,
  contentClassName,
  searchPlaceholder,
  variant,
  size,
  ...props
}: ModelSelectorProps) {
  return (
    <ModelSelectorRoot {...props}>
      <ModelSelectorTrigger className={className} size={size} variant={variant} />
      <ModelSelectorContent align={align} className={contentClassName}>
        <ModelSelectorSearch placeholder={searchPlaceholder} />
        <ModelSelectorList />
      </ModelSelectorContent>
    </ModelSelectorRoot>
  )
})

export const ModelSelector = Object.assign(ModelSelectorConvenience, {
  Root: ModelSelectorRoot,
  Trigger: ModelSelectorTrigger,
  Value: ModelSelectorValue,
  Content: ModelSelectorContent,
  Search: ModelSelectorSearch,
  List: ModelSelectorList,
  Empty: ModelSelectorEmpty,
  Group: ModelSelectorGroup,
  Separator: ModelSelectorSeparator,
  Item: ModelSelectorItem,
  Footer: ModelSelectorFooter,
})
