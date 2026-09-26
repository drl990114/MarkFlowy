import { useEffect, useMemo, useRef, useState } from 'react'
import { ColorPickerPanel } from '@/components/ui/color-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
    <section className='space-y-3' aria-label={labels.edit}>
      <fieldset disabled={pending} inert={pending} className='m-0 min-w-0 space-y-3 border-0 p-0'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            variant='ghost'
            onClick={() => {
              try {
                writeThemeDraft(draftKey, draft.current)
                onClose()
              } catch (cause) {
                setError(String(cause))
              }
            }}
          >
            {labels.close}
          </Button>
          <Button
            variant='outline'
            disabled={jsonDirty || !history.past.length}
            onClick={() => {
              resetTokenInput()
              setError('')
              setHistory(undoTheme)
            }}
          >
            {labels.undo}
          </Button>
          <Button
            variant='outline'
            disabled={jsonDirty || !history.future.length}
            onClick={() => {
              resetTokenInput()
              setError('')
              setHistory(redoTheme)
            }}
          >
            {labels.redo}
          </Button>
          <Button
            variant='outline'
            disabled={jsonDirty}
            onClick={() => {
              setAdvanced(!advanced)
            }}
          >
            {labels.advanced}
          </Button>
          <Button
            variant='outline'
            disabled={jsonDirty || invalidTokenInput}
            onClick={() => void onExport(document).catch((cause) => setError(String(cause)))}
          >
            {labels.export}
          </Button>
          <Button disabled={pending || jsonDirty || invalidTokenInput} onClick={() => void save()}>
            {labels.save}
          </Button>
        </div>
        <fieldset
          disabled={jsonDirty}
          inert={jsonDirty}
          className='m-0 min-w-0 space-y-3 border-0 p-0'
        >
          <div className='grid grid-cols-2 gap-2'>
            <label>
              {labels.name}
              <Input
                value={document.name}
                onChange={(event) => change({ ...document, name: event.target.value })}
              />
            </label>
            <label>
              {labels.author}
              <Input
                value={document.author ?? ''}
                onChange={(event) => change({ ...document, author: event.target.value })}
              />
            </label>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <SelectRoot
              value={variant.id}
              onValueChange={(id) => {
                resetTokenInput()
                setError('')
                setVariantId(id)
              }}
            >
              <SelectTrigger aria-label={labels.variant}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {document.variants.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
            <Input
              className='max-w-52'
              aria-label={labels.variant}
              value={variant.name}
              onChange={(event) => changeVariant({ ...variant, name: event.target.value })}
            />
            {(['light', 'dark'] as const).map((mode) => (
              <Button
                key={mode}
                variant='outline'
                size='sm'
                onClick={() => {
                  const id = `${mode}-${crypto.randomUUID()}`
                  change({
                    ...document,
                    variants: [
                      ...document.variants,
                      { id, name: `${document.name} ${mode}`, mode, tokens: {} },
                    ],
                  })
                  setVariantId(id)
                }}
              >
                {mode === 'light' ? labels.addLight : labels.addDark}
              </Button>
            ))}
            <Button
              variant='ghost'
              size='sm'
              disabled={document.variants.length === 1}
              onClick={() =>
                change({
                  ...document,
                  variants: document.variants.filter((item) => item.id !== variant.id),
                })
              }
            >
              {labels.removeVariant}
            </Button>
          </div>
        </fieldset>
        {error && (
          <p role='alert' className='text-destructive'>
            {error}
          </p>
        )}
        <p className='text-ui-caption text-muted-foreground'>{labels.preferences}</p>
        {advanced ? (
          <div className='grid gap-3 md:grid-cols-2'>
            <div>
              <label>
                {labels.json}
                <Textarea
                  className='h-96 font-mono'
                  aria-label={labels.json}
                  value={json}
                  onChange={(event) => {
                    setJson(event.target.value)
                    setJsonDirty(true)
                  }}
                />
              </label>
              <Button
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
            <label>
              {labels.css}
              <Textarea
                disabled={jsonDirty}
                className='h-96 font-mono'
                value={variant.css ?? ''}
                onChange={(event) => changeVariant({ ...variant, css: event.target.value })}
              />
            </label>
          </div>
        ) : null}
        <div className='flex flex-wrap items-center gap-4'>
          <label className='flex items-center gap-2'>
            <Checkbox checked={inspect} onCheckedChange={(value) => setInspect(value === true)} />
            {labels.inspect}
          </label>
          <label className='flex items-center gap-2'>
            <Checkbox
              checked={includeCss}
              onCheckedChange={(value) => setIncludeCss(value === true)}
            />
            {labels.includeCss}
          </label>
        </div>
        <div className='grid min-h-[600px] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]'>
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
          <fieldset
            disabled={jsonDirty}
            inert={jsonDirty}
            className='m-0 min-w-0 space-y-3 border-0 p-0'
          >
            <Input
              aria-label={labels.search}
              placeholder={labels.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className='flex items-center gap-2'>
              <Checkbox
                checked={modified}
                onCheckedChange={(value) => setModified(value === true)}
              />
              {labels.modified}
            </label>
            <div className='max-h-52 overflow-auto rounded-md border border-border p-2'>
              {groups.map((group) => (
                <details key={group} open={group === selected.split('.')[0] || Boolean(search)}>
                  <summary className='cursor-pointer p-1 font-medium'>{group}</summary>
                  {names
                    .filter((name) => name.startsWith(`${group}.`))
                    .map((name) => (
                      <Button
                        className='w-full justify-start truncate'
                        key={name}
                        size='sm'
                        variant={selected === name ? 'secondary' : 'ghost'}
                        onClick={() => {
                          resetTokenInput()
                          setError('')
                          setSelected(name)
                        }}
                      >
                        {name}
                        {Object.hasOwn(variant.tokens, name) ? ' •' : ''}
                      </Button>
                    ))}
                </details>
              ))}
            </div>
            <strong className='block break-all'>{selected}</strong>
            <p className='text-ui-caption text-muted-foreground'>
              {typeof currentValue === 'object'
                ? `${labels.linked}: ${currentValue.ref}`
                : Object.hasOwn(variant.tokens, selected)
                  ? labels.value
                  : labels.inherited}
            </p>
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
              <SelectTrigger aria-label={labels.link}>
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
