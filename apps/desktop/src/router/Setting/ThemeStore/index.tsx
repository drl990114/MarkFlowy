import { useEffect, useRef, useState } from 'react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { dialog } from '@/services/dialog'
import useThemeStore from '@/stores/useThemeStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import appSettingService from '@/services/app-setting'
import { useThemeLibrary, type CssSnippet } from '@/themes/library'
import { copyTheme, isSemanticTheme, themeLabel } from '@/themes/runtime'
import {
  parseThemeDocument,
  themeDocumentSchema,
  type ThemeDocument,
} from '@markflowy/theme/semantic'
import themeData from '../../../../../../community-themes.json'
import { ThemeEditor } from './ThemeEditor'
import { readThemeDrafts, themeDraftKey, type ThemeDraft } from './drafts'
import { useThemeLabels } from './labels'
export interface ThemeItem {
  id: string
  name: string
  author: string
  url: string
  version: string
}
export function ThemeStore() {
  const labels = useThemeLabels()
  const library = useThemeLibrary()
  const personalTypography = useAppSettingStore(
    (state) => state.settingData.theme_use_personal_typography !== false,
  )
  const themes = useThemeStore((state) => state.themes)
  const current = useThemeStore((state) => state.curTheme)
  const [editing, setEditing] = useState<ThemeDraft>()
  const [snippet, setSnippet] = useState<CssSnippet>()
  const [drafts, setDrafts] = useState(readThemeDrafts)
  const openEditor = (document: ThemeDocument, variantId?: string) => {
    // Opening an existing theme resumes its unsaved session instead of replacing it.
    const existing = readThemeDrafts().find((draft) => draft.key === themeDraftKey(document.id))
    setEditing(
      existing ?? {
        key: themeDraftKey(document.id),
        session: { version: 1, document, variantId: variantId ?? document.variants[0].id },
      },
    )
  }
  const [error, setError] = useState('')
  const lock = useRef(false)
  const [pending, setPending] = useState(false)
  const [installedOnly, setInstalledOnly] = useState(false)
  const { loaded, reload } = library
  useEffect(() => {
    if (!loaded) void reload().catch((cause) => setError(String(cause)))
  }, [loaded, reload])
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError('')
    try {
      await operation()
    } catch (cause) {
      setError(String(cause))
    } finally {
      lock.current = false
      setPending(false)
    }
  }
  const persist = async (document: ThemeDocument, variantId?: string) => {
    const existing = useThemeLibrary.getState().documents.some((item) => item.id === document.id)
    if (existing && editing?.session.document.id !== document.id) {
      const choice = await dialog.confirm({
        title: labels.title,
        content: labels.replace,
        actions: [
          { id: 'cancel', label: labels.cancel },
          { id: 'copy', label: labels.saveCopy },
          { id: 'replace', label: labels.replaceAction, primary: true },
        ],
      })
      if (choice === 'cancel' || !choice) return false
      if (choice === 'copy') document = { ...document, id: `personal-${crypto.randomUUID()}` }
    }
    await library.mutate({ type: 'save', document, replace: existing })
    if (variantId) {
      const variant =
        document.variants.find((item) => item.id === variantId) ?? document.variants[0]
      const store = useThemeStore.getState()
      await store.applyThemeSelection({
        [variant.mode === 'light' ? 'lightThemeName' : 'darkThemeName']:
          `${document.id}/${variant.id}`,
        themeMode: variant.mode,
      })
    }
    return true
  }
  const exportJson = async (value: unknown, name = 'theme.json') => {
    const path = await save({
      defaultPath: name,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (path) await writeTextFile(path, JSON.stringify(value, null, 2))
  }
  const readImport = async (extension: 'json' | 'css') => {
    const path = await open({
      multiple: false,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
      fileAccessMode: 'scoped',
    })
    return typeof path === 'string'
      ? { name: path.split(/[\\/]/).pop() ?? extension, text: await readTextFile(path) }
      : undefined
  }
  if (editing)
    return (
      <ThemeEditor
        key={editing.key}
        initial={editing.session.document}
        initialVariantId={editing.session.variantId}
        initialJson={editing.session.json}
        draftKey={editing.key}
        onClose={() => {
          setEditing(undefined)
          setDrafts(readThemeDrafts())
        }}
        onSave={persist}
        onExport={(document) => exportJson(document, `${document.id}.json`)}
      />
    )
  const catalog = themeData as ThemeItem[]
  return (
    <div className='space-y-6'>
      <label className='flex items-center gap-2'>
        <Checkbox
          checked={personalTypography}
          disabled={pending}
          onCheckedChange={(value) =>
            void run(() =>
              appSettingService.writeSettingData(
                { key: 'theme_use_personal_typography' },
                value === true,
              ),
            )
          }
        />
        {labels.personalTypography}
      </label>
      <div className='flex flex-wrap gap-2'>
        <Button
          disabled={pending}
          onClick={() =>
            openEditor(
              copyTheme(current),
              isSemanticTheme(current) ? current.variant.id : undefined,
            )
          }
        >
          {labels.create}
        </Button>
        <Button
          variant='outline'
          disabled={pending}
          onClick={() =>
            void run(async () => {
              const file = await readImport('json')
              if (file) {
                await persist(parseThemeDocument(JSON.parse(file.text)))
              }
            })
          }
        >
          {labels.import}
        </Button>
        <Button
          variant='ghost'
          onClick={() =>
            void run(() => exportJson(themeDocumentSchema, 'markflowy-theme.schema.json'))
          }
        >
          {labels.schema}
        </Button>
      </div>
      {(error || library.error) && (
        <div role='alert' className='text-destructive'>
          {error || library.error}
          <Button variant='outline' onClick={() => void run(library.reload)}>
            {labels.retry}
          </Button>
        </div>
      )}
      {drafts.map((draft) => (
        <div
          key={draft.key}
          className='flex flex-wrap items-center gap-2 rounded-md border border-border p-3'
        >
          <span className='min-w-0 flex-1 truncate'>
            {labels.draft} · {draft.session.document.name}
          </span>
          <Button variant='outline' disabled={pending} onClick={() => setEditing(draft)}>
            {labels.resume}
          </Button>
          <Button
            variant='ghost'
            disabled={pending}
            onClick={() => {
              try {
                sessionStorage.removeItem(draft.key)
                setDrafts(readThemeDrafts())
              } catch (cause) {
                setError(String(cause))
              }
            }}
          >
            {labels.discard}
          </Button>
        </div>
      ))}
      <section aria-label={labels.title} className='space-y-2'>
        <h3>{labels.title}</h3>
        {themes.map((theme) => (
          <div
            key={theme.name}
            className='flex flex-wrap items-center gap-2 rounded-md border border-border p-3'
          >
            <span className='min-w-0 flex-1 truncate'>
              {themeLabel(theme)} <span className='text-muted-foreground'>· {theme.mode}</span>
            </span>
            <Button
              size='sm'
              variant='outline'
              disabled={pending}
              onClick={() =>
                void run(() =>
                  useThemeStore.getState().applyThemeSelection({
                    [theme.mode === 'light' ? 'lightThemeName' : 'darkThemeName']: theme.name,
                    themeMode: theme.mode,
                  }),
                )
              }
            >
              {labels.apply}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={pending}
              onClick={() =>
                openEditor(copyTheme(theme), isSemanticTheme(theme) ? theme.variant.id : undefined)
              }
            >
              {labels.copy}
            </Button>
            {isSemanticTheme(theme) && (
              <>
                <Button
                  size='sm'
                  variant='ghost'
                  disabled={pending}
                  onClick={() => openEditor(structuredClone(theme.document), theme.variant.id)}
                >
                  {labels.edit}
                </Button>
                <Button
                  size='sm'
                  variant='destructive'
                  disabled={pending}
                  onClick={() =>
                    void run(async () => {
                      if (
                        (await dialog.confirm({
                          title: labels.remove,
                          content: labels.deleteConfirm,
                          actions: [
                            { id: 'cancel', label: labels.cancel },
                            { id: 'remove', label: labels.remove, primary: true, danger: true },
                          ],
                        })) === 'remove'
                      )
                        await library.mutate({ type: 'remove', id: theme.document.id })
                    })
                  }
                >
                  {labels.remove}
                </Button>
              </>
            )}
          </div>
        ))}
      </section>
      <section className='space-y-2' aria-label={labels.snippets}>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='flex-1'>{labels.snippets}</h3>
          <Button
            size='sm'
            variant='outline'
            disabled={pending}
            onClick={() =>
              setSnippet({
                id: crypto.randomUUID(),
                name: labels.untitledCss,
                css: '',
                enabled: false,
              })
            }
          >
            {labels.createCss}
          </Button>
          <Button
            size='sm'
            variant='outline'
            disabled={pending}
            onClick={() =>
              void run(async () => {
                const file = await readImport('css')
                if (file)
                  await library.mutate({
                    type: 'saveSnippet',
                    snippet: {
                      id: crypto.randomUUID(),
                      name: file.name,
                      css: file.text,
                      enabled: false,
                    },
                  })
              })
            }
          >
            {labels.addCss}
          </Button>
          <Button
            size='sm'
            variant='outline'
            disabled={pending}
            onClick={() => void run(() => library.mutate({ type: 'disableSnippets' }))}
          >
            {labels.disableAll}
          </Button>
        </div>
        {!library.snippets.length && <p className='text-muted-foreground'>{labels.noSnippets}</p>}
        {library.snippets.map((item, index) => (
          <div
            key={item.id}
            className='flex flex-wrap items-center gap-2 rounded-md border border-border p-2'
          >
            <Checkbox
              aria-label={`${labels.enabled}: ${item.name}`}
              checked={item.enabled}
              disabled={pending}
              onCheckedChange={(enabled) =>
                void run(() =>
                  library.mutate({
                    type: 'saveSnippet',
                    snippet: { ...item, enabled: enabled === true },
                  }),
                )
              }
            />
            <span className='min-w-0 flex-1 truncate'>{item.name}</span>
            <Button
              size='sm'
              variant='ghost'
              disabled={index === 0 || pending}
              onClick={() =>
                void run(() => library.mutate({ type: 'moveSnippet', id: item.id, offset: -1 }))
              }
            >
              {labels.up}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              disabled={index === library.snippets.length - 1 || pending}
              onClick={() =>
                void run(() => library.mutate({ type: 'moveSnippet', id: item.id, offset: 1 }))
              }
            >
              {labels.down}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={pending}
              onClick={() => setSnippet({ ...item })}
            >
              {labels.editCss}
            </Button>
            <Button
              size='sm'
              variant='destructive'
              disabled={pending}
              onClick={() => void run(() => library.mutate({ type: 'removeSnippet', id: item.id }))}
            >
              {labels.remove}
            </Button>
          </div>
        ))}
        {snippet && (
          <fieldset
            disabled={pending}
            inert={pending}
            className='m-0 min-w-0 space-y-2 rounded-md border border-border p-3'
          >
            <Input
              aria-label={labels.name}
              value={snippet.name}
              onChange={(event) => setSnippet({ ...snippet, name: event.target.value })}
            />
            <Textarea
              aria-label={labels.css}
              className='h-64 font-mono'
              value={snippet.css}
              onChange={(event) => setSnippet({ ...snippet, css: event.target.value })}
            />
            <Button
              disabled={pending}
              onClick={() =>
                void run(async () => {
                  await library.mutate({ type: 'saveSnippet', snippet })
                  setSnippet(undefined)
                })
              }
            >
              {labels.saveCss}
            </Button>
            <Button variant='ghost' onClick={() => setSnippet(undefined)}>
              {labels.cancel}
            </Button>
          </fieldset>
        )}
      </section>
      <section aria-label={labels.catalog} className='space-y-2'>
        <h3>{labels.catalog}</h3>
        <label className='flex items-center gap-2'>
          <Checkbox
            checked={installedOnly}
            onCheckedChange={(value) => setInstalledOnly(value === true)}
          />
          {labels.installedOnly}
        </label>
        {!catalog.length && <p className='text-muted-foreground'>{labels.emptyCatalog}</p>}
        {catalog
          .filter(
            (item) =>
              !installedOnly || library.documents.some((document) => document.id === item.id),
          )
          .map((item) => (
            <div key={item.id} className='flex items-center gap-2'>
              <span className='flex-1'>
                {item.name} · {item.author} · {item.version}
              </span>
              <Button
                variant='outline'
                disabled={pending}
                onClick={() =>
                  void run(async () => {
                    const response = await nativeFetch(item.url)
                    if (!response.ok) throw new Error(`HTTP ${response.status}`)
                    const document = parseThemeDocument(await response.json())
                    if (document.id !== item.id) throw new Error('Theme id differs from catalog')
                    await persist(document)
                  })
                }
              >
                {labels.install}
              </Button>
            </div>
          ))}
      </section>
    </div>
  )
}
