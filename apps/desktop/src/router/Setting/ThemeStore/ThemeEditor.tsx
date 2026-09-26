import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  CodeIcon,
  DownloadIcon,
  EllipsisIcon,
  FilterIcon,
  MoonIcon,
  MousePointer2Icon,
  Redo2Icon,
  SearchIcon,
  SlidersHorizontalIcon,
  SunIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from 'lucide-react'
import { ColorPickerPanel } from '@/components/ui/color-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { PopoverRoot, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Toggle } from '@/components/ui/toggle'
import {
  SelectRoot,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  themeTokens,
  themeTokenNames,
  parseThemeDocument,
  resolveTheme,
  type ThemeDocument,
  type ThemeVariant,
  type ThemeTokenName,
  type TokenValue,
} from '@markflowy/theme/semantic'
import { createThemeHistory, changeTheme, undoTheme, redoTheme } from '@/themes/editorHistory'
import { useThemeLibrary } from '@/themes/library'
import { ThemePreview } from './ThemePreview'
import { useThemeLabels } from './labels'
import { themeDraftKey, writeThemeDraft, type ThemeEditorSession } from './drafts'
export function ThemeEditor({
  initial,
  initialVariantId,
  initialJson,
  draftKey = themeDraftKey(initial.id),
  onClose,
  onSave,
  onExport,
}: {
  initial: ThemeDocument
  initialVariantId?: string
  initialJson?: string
  draftKey?: string
  onClose: () => void
  onSave: (document: ThemeDocument, variant: string) => Promise<boolean>
  onExport: (document: ThemeDocument) => Promise<void>
}) {
  const labels = useThemeLabels()
  const [history, setHistory] = useState(() => createThemeHistory(initial))
  const document = history.present
  const [variantId, setVariantId] = useState(initialVariantId ?? initial.variants[0].id)
  const variant = document.variants.find((item) => item.id === variantId) ?? document.variants[0]
  const resolved = useMemo(() => resolveTheme(document, variant), [document, variant])
  const [search, setSearch] = useState('')
  const [modified, setModified] = useState(false)
  const [inspect, setInspect] = useState(false)
  const [selected, setSelected] = useState<ThemeTokenName>('surface.canvas')
  const [includeCss, setIncludeCss] = useState(false)
  const [advanced, setAdvanced] = useState(initialJson !== undefined)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [json, setJson] = useState(initialJson ?? JSON.stringify(initial, null, 2))
  const [jsonDirty, setJsonDirty] = useState(initialJson !== undefined)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [invalidTokenInput, setInvalidTokenInput] = useState(false)
  const [tokenInputRevision, setTokenInputRevision] = useState(0)
  const resetTokenInput = () => {
    setInvalidTokenInput(false)
    setTokenInputRevision((value) => value + 1)
  }
  const draft = useRef<ThemeEditorSession>({ version: 1, document, variantId: variant.id })
  const saved = useRef(false)
  draft.current = { version: 1, document, variantId: variant.id, ...(jsonDirty ? { json } : {}) }
  const drag = useRef(false)
  const firstDrag = useRef(true)
  const snippets = useThemeLibrary((state) => state.snippets)
  const change = (next: ThemeDocument, grouped = false) => {
    try {
      const valid = parseThemeDocument(next)
      // Keep in-progress spacing while typing display names; persistence normalizes them.
      valid.name = next.name
      valid.variants.forEach((item, index) => {
        item.name = next.variants[index].name
      })
      setHistory((previous) => changeTheme(previous, valid, grouped))
      resetTokenInput()
      setError('')
      return true
    } catch (cause) {
      setError(String(cause))
      return false
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (saved.current) return
      try {
        writeThemeDraft(draftKey, draft.current)
      } catch (cause) {
        setError(String(cause))
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [document, variant.id, json, jsonDirty, draftKey])
  useEffect(
    () => () => {
      if (saved.current) return
      try {
        writeThemeDraft(draftKey, draft.current)
      } catch {
        /* The editor is unmounting; periodic saves report storage failures while open. */
      }
    },
    [draftKey],
  )
  const changeVariant = (next: ThemeVariant, grouped = false) =>
    change(
      {
        ...document,
        variants: document.variants.map((item) => (item.id === variant.id ? next : item)),
      },
      grouped,
    )
  const token = (name: ThemeTokenName, value?: TokenValue, grouped = false) => {
    const tokens = { ...variant.tokens }
    if (value === undefined) delete tokens[name]
    else tokens[name] = value
    return changeVariant({ ...variant, tokens }, grouped)
  }
  useEffect(() => {
    if (!jsonDirty) setJson(JSON.stringify(document, null, 2))
  }, [document, jsonDirty])
  const save = async () => {
    if (pending || jsonDirty || invalidTokenInput) return
    setPending(true)
    try {
      if (!(await onSave(document, variant.id))) return
      saved.current = true
      sessionStorage.removeItem(draftKey)
      onClose()
    } catch (cause) {
      setError(String(cause))
    } finally {
      setPending(false)
    }
  }
  const names = themeTokenNames.filter(
    (name) =>
      (!modified || Object.hasOwn(variant.tokens, name)) &&
      name.toLowerCase().includes(search.toLowerCase()),
  )
  const groups = [...new Set(names.map((name) => name.split('.')[0]))]
  const currentValue = variant.tokens[selected] ?? themeTokens[selected][variant.mode]
  return (
    <section className='@container/theme-editor space-y-3 text-ui-control' aria-label={labels.edit}>
      <fieldset disabled={pending} inert={pending} className='m-0 min-w-0 space-y-3 border-0 p-0'>
        <div className='flex flex-wrap items-center gap-1.5 border-b border-border pb-3'>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={labels.close}
            title={labels.close}
            onClick={() => {
              try {
                writeThemeDraft(draftKey, draft.current)
                onClose()
              } catch (cause) {
                setError(String(cause))
              }
            }}
          >
            <ArrowLeftIcon className='size-4' aria-hidden />
          </Button>
          <fieldset
            disabled={jsonDirty}
            inert={jsonDirty}
            className='m-0 flex min-w-0 flex-1 basis-60 items-center gap-2 border-0 p-0'
          >
            <Input
              inputSize='sm'
              className='min-w-24 flex-1 border-transparent bg-transparent px-1.5 font-medium hover:border-input focus:border-input'
              aria-label={labels.name}
              value={document.name}
              onChange={(event) => change({ ...document, name: event.target.value })}
            />
            <SelectRoot
              value={variant.id}
              onValueChange={(id) => {
                resetTokenInput()
                setError('')
                setVariantId(id)
              }}
            >
              <SelectTrigger size='sm' className='w-auto max-w-40' aria-label={labels.variant}>
                {variant.mode === 'light' ? (
                  <SunIcon className='size-3.5' aria-hidden />
                ) : (
                  <MoonIcon className='size-3.5' aria-hidden />
                )}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {document.variants.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name === document.name ? labels[item.mode] : item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </fieldset>
          <div className='ml-auto flex items-center gap-1'>
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label={labels.undo}
              title={labels.undo}
              disabled={jsonDirty || !history.past.length}
              onClick={() => {
                resetTokenInput()
                setError('')
                setHistory(undoTheme)
              }}
            >
              <Undo2Icon className='size-3.5' aria-hidden />
            </Button>
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label={labels.redo}
              title={labels.redo}
              disabled={jsonDirty || !history.future.length}
              onClick={() => {
                resetTokenInput()
                setError('')
                setHistory(redoTheme)
              }}
            >
              <Redo2Icon className='size-3.5' aria-hidden />
            </Button>
            <PopoverRoot open={optionsOpen} onOpenChange={setOptionsOpen}>
              <PopoverTrigger asChild>
                <Button
                  size='icon-sm'
                  variant='ghost'
                  aria-label={labels.options}
                  title={labels.options}
                >
                  <EllipsisIcon className='size-4' aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align='end'
                aria-label={labels.options}
                className='w-72 max-w-[calc(100vw-2rem)] p-3'
              >
                <fieldset
                  disabled={pending}
                  inert={pending}
                  className='m-0 min-w-0 space-y-3 border-0 p-0'
                >
                  <p className='m-0 text-ui-control font-medium'>{labels.options}</p>
                  <fieldset
                    disabled={jsonDirty}
                    inert={jsonDirty}
                    className='m-0 min-w-0 space-y-3 border-0 p-0'
                  >
                    <label className='flex min-w-0 flex-col gap-1 text-ui-caption text-muted-foreground'>
                      {labels.author}
                      <Input
                        inputSize='sm'
                        value={document.author ?? ''}
                        onChange={(event) => change({ ...document, author: event.target.value })}
                      />
                    </label>
                    <div className='flex items-end gap-2'>
                      <label className='flex min-w-0 flex-1 flex-col gap-1 text-ui-caption text-muted-foreground'>
                        {labels.variant}
                        <Input
                          inputSize='sm'
                          value={variant.name}
                          onChange={(event) =>
                            changeVariant({ ...variant, name: event.target.value })
                          }
                        />
                      </label>
                      <Button
                        variant='destructive'
                        size='icon-sm'
                        aria-label={labels.removeVariant}
                        title={labels.removeVariant}
                        disabled={document.variants.length === 1}
                        onClick={() =>
                          change({
                            ...document,
                            variants: document.variants.filter((item) => item.id !== variant.id),
                          })
                        }
                      >
                        <Trash2Icon className='size-3.5' aria-hidden />
                      </Button>
                    </div>
                    <div className='flex flex-col gap-1'>
                      {(['light', 'dark'] as const).map((mode) => (
                        <Button
                          key={mode}
                          variant='ghost'
                          size='sm'
                          className='justify-start'
                          onClick={() => {
                            const id = `${mode}-${crypto.randomUUID()}`
                            if (
                              change({
                                ...document,
                                variants: [
                                  ...document.variants,
                                  {
                                    id,
                                    name: `${document.name} ${labels[mode]}`,
                                    mode,
                                    tokens: {},
                                  },
                                ],
                              })
                            )
                              setVariantId(id)
                          }}
                        >
                          {mode === 'light' ? (
                            <SunIcon className='size-3.5' aria-hidden />
                          ) : (
                            <MoonIcon className='size-3.5' aria-hidden />
                          )}
                          {mode === 'light' ? labels.addLight : labels.addDark}
                        </Button>
                      ))}
                    </div>
                  </fieldset>
                  <div className='flex flex-col gap-1 border-t border-border pt-2'>
                    <Button
                      size='sm'
                      variant='ghost'
                      className='justify-start'
                      disabled={jsonDirty}
                      aria-pressed={advanced}
                      onClick={() => {
                        setAdvanced(!advanced)
                        setOptionsOpen(false)
                      }}
                    >
                      <CodeIcon className='size-3.5' aria-hidden />
                      {labels.advanced}
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      className='justify-start'
                      disabled={jsonDirty || invalidTokenInput}
                      onClick={() =>
                        void onExport(document).catch((cause) => setError(String(cause)))
                      }
                    >
                      <DownloadIcon className='size-3.5' aria-hidden />
                      {labels.export}
                    </Button>
                  </div>
                </fieldset>
              </PopoverContent>
            </PopoverRoot>
            <Button
              size='sm'
              disabled={pending || jsonDirty || invalidTokenInput}
              onClick={() => void save()}
            >
              {labels.save}
            </Button>
          </div>
        </div>
        {error && (
          <p role='alert' className='text-destructive'>
            {error}
          </p>
        )}
        {advanced ? (
          <section className='space-y-2 border-b border-border pb-3' aria-label={labels.advanced}>
            <div className='flex items-center justify-between'>
              <span className='font-medium'>{labels.advanced}</span>
              <Button
                size='icon-sm'
                variant='ghost'
                disabled={jsonDirty}
                aria-label={labels.closeAdvanced}
                title={labels.closeAdvanced}
                onClick={() => setAdvanced(false)}
              >
                <XIcon className='size-3.5' aria-hidden />
              </Button>
            </div>
            <div className='grid gap-3 @min-[36rem]/theme-editor:grid-cols-2'>
              <div>
                <label className='flex min-w-0 flex-col gap-1'>
                  {labels.json}
                  <Textarea
                    className='h-96 font-mono text-ui-control'
                    aria-label={labels.json}
                    value={json}
                    onChange={(event) => {
                      setJson(event.target.value)
                      setJsonDirty(true)
                    }}
                  />
                </label>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    try {
                      change(parseThemeDocument(JSON.parse(json)))
                      setJsonDirty(false)
                    } catch (cause) {
                      setError(String(cause))
                    }
                  }}
                >
                  {labels.applyJson}
                </Button>
                {jsonDirty && (
                  <>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => {
                        setJsonDirty(false)
                        setJson(JSON.stringify(document, null, 2))
                        setError('')
                      }}
                    >
                      {labels.revertJson}
                    </Button>
                    <p className='text-ui-caption text-muted-foreground'>{labels.pendingJson}</p>
                  </>
                )}
              </div>
              <label className='flex min-w-0 flex-col gap-1'>
                {labels.css}
                <Textarea
                  disabled={jsonDirty}
                  className='h-96 font-mono text-ui-control'
                  value={variant.css ?? ''}
                  onChange={(event) => changeVariant({ ...variant, css: event.target.value })}
                />
              </label>
            </div>
          </section>
        ) : null}
        <div className='grid items-start gap-4 @min-[44rem]/theme-editor:grid-cols-[minmax(0,1fr)_15rem]'>
          <div className='min-w-0 space-y-2'>
            <div className='flex min-h-7 flex-wrap items-center justify-between gap-1'>
              <span className='text-ui-caption text-muted-foreground'>{labels.preview}</span>
              <div className='flex items-center gap-1'>
                <Toggle
                  size='sm'
                  pressed={inspect}
                  onPressedChange={setInspect}
                  aria-label={labels.inspect}
                  className='text-ui-caption'
                >
                  <MousePointer2Icon className='size-3.5' aria-hidden />
                  {labels.inspect}
                </Toggle>
                <PopoverRoot>
                  <PopoverTrigger asChild>
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label={labels.previewOptions}
                      title={labels.previewOptions}
                    >
                      <SlidersHorizontalIcon className='size-3.5' aria-hidden />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align='end'
                    aria-label={labels.previewOptions}
                    className='w-64 max-w-[calc(100vw-2rem)] space-y-3 p-3'
                  >
                    <label className='flex items-center gap-2 text-ui-control'>
                      <Checkbox
                        checked={includeCss}
                        disabled={pending}
                        onCheckedChange={(value) => setIncludeCss(value === true)}
                      />
                      {labels.includeCss}
                    </label>
                    <p className='m-0 text-ui-caption text-muted-foreground'>
                      {labels.preferences}
                    </p>
                  </PopoverContent>
                </PopoverRoot>
              </div>
            </div>
            <ThemePreview
              theme={resolved}
              snippets={
                includeCss
                  ? snippets.filter((item) => item.enabled).map(({ id, css }) => ({ id, css }))
                  : []
              }
              inspect={inspect}
              onInspect={(name) => {
                resetTokenInput()
                setError('')
                setSelected(name)
                setSearch('')
                setModified(false)
              }}
            />
          </div>
          <fieldset
            disabled={jsonDirty}
            inert={jsonDirty}
            className='m-0 min-w-0 space-y-2 border-0 p-0'
          >
            <div className='flex items-center gap-1'>
              <div className='relative min-w-0 flex-1'>
                <SearchIcon
                  className='pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground'
                  aria-hidden
                />
                <Input
                  inputSize='sm'
                  className='pl-7'
                  aria-label={labels.search}
                  placeholder={labels.search}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Toggle
                size='sm'
                pressed={modified}
                onPressedChange={setModified}
                aria-label={labels.modified}
                title={labels.modified}
              >
                <FilterIcon className='size-3.5' aria-hidden />
              </Toggle>
            </div>
            <div className='h-44 overflow-auto rounded-sm border border-border p-1'>
              {!names.length && (
                <p className='m-0 px-2 py-4 text-ui-caption text-muted-foreground'>
                  {labels.noTokens}
                </p>
              )}
              {groups.map((group) => (
                <details key={group} open={group === selected.split('.')[0] || Boolean(search)}>
                  <summary className='cursor-default px-1 py-1 text-ui-caption font-medium text-muted-foreground'>
                    {group}
                  </summary>
                  {names
                    .filter((name) => name.startsWith(`${group}.`))
                    .map((name) => (
                      <Button
                        className='w-full justify-start gap-2 font-normal'
                        aria-label={name}
                        aria-pressed={selected === name}
                        title={name}
                        key={name}
                        size='sm'
                        variant={selected === name ? 'secondary' : 'ghost'}
                        onClick={() => {
                          resetTokenInput()
                          setError('')
                          setSelected(name)
                        }}
                      >
                        {themeTokens[name].kind === 'color' && (
                          <span
                            aria-hidden
                            className='size-3 shrink-0 rounded-[3px] border border-border'
                            style={{ background: resolved.tokens[name] }}
                          />
                        )}
                        <span className='min-w-0 flex-1 truncate text-left'>
                          {name.slice(group.length + 1)}
                        </span>
                        {Object.hasOwn(variant.tokens, name) && (
                          <span aria-hidden className='text-muted-foreground'>
                            •
                          </span>
                        )}
                      </Button>
                    ))}
                </details>
              ))}
            </div>
            <div className='pt-1'>
              <strong className='block break-all text-ui-control font-medium'>{selected}</strong>
              <p className='m-0 mt-1 text-ui-caption text-muted-foreground'>
                {typeof currentValue === 'object'
                  ? `${labels.linked}: ${currentValue.ref}`
                  : Object.hasOwn(variant.tokens, selected)
                    ? labels.value
                    : labels.inherited}
              </p>
            </div>
            {themeTokens[selected].kind === 'color' && (
              <div
                onPointerDownCapture={() => {
                  drag.current = true
                  firstDrag.current = true
                }}
                onPointerUpCapture={() => {
                  drag.current = false
                }}
                onPointerCancel={() => {
                  drag.current = false
                }}
              >
                <ColorPickerPanel
                  className='w-full pt-1 [&_.react-colorful]:h-36 [&_.react-colorful]:w-full [&_.react-colorful\_\_pointer]:size-4'
                  alpha
                  value={resolved.tokens[selected]}
                  onValueChange={(value) => {
                    token(selected, value, drag.current && !firstDrag.current)
                    firstDrag.current = false
                  }}
                />
              </div>
            )}
            <TokenInput
              key={`${variant.id}:${selected}:${resolved.tokens[selected]}:${tokenInputRevision}`}
              value={resolved.tokens[selected]}
              onCommit={(value) => token(selected, value)}
              onValidationChange={(invalid) => {
                setInvalidTokenInput(invalid)
                if (!invalid && invalidTokenInput) setError('')
              }}
              label={labels.value}
            />
            <SelectRoot
              value={typeof currentValue === 'object' ? currentValue.ref : '__value'}
              onValueChange={(name) =>
                token(selected, name === '__value' ? resolved.tokens[selected] : { ref: name })
              }
            >
              <SelectTrigger size='sm' aria-label={labels.link}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__value'>{labels.value}</SelectItem>
                {themeTokenNames
                  .filter(
                    (name) =>
                      name !== selected && themeTokens[name].kind === themeTokens[selected].kind,
                  )
                  .map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </SelectRoot>
            <Button variant='outline' size='sm' onClick={() => token(selected)}>
              {labels.reset}
            </Button>
            {(variant.css || includeCss) && (
              <p className='text-ui-caption text-muted-foreground'>{labels.customCss}</p>
            )}
          </fieldset>
        </div>
      </fieldset>
    </section>
  )
}
function TokenInput({
  value,
  onCommit,
  onValidationChange,
  label,
}: {
  value: string
  onCommit: (value: string) => boolean
  onValidationChange: (invalid: boolean) => void
  label: string
}) {
  const [text, setText] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const commit = () => {
    if (text === value) {
      setInvalid(false)
      onValidationChange(false)
      return
    }
    const valid = onCommit(text)
    setInvalid(!valid)
    onValidationChange(!valid)
  }
  return (
    <Input
      inputSize='sm'
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
      }}
    />
  )
}
