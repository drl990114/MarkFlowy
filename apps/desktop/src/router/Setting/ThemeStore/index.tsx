import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import { builtInThemes, type MfTheme } from '@markflowy/theme'
import { Check, ChevronDown, ArrowLeft, Download, FileJson, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenuItemPrimitive as MenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { dialog } from '@/services/dialog'
import useThemeStore from '@/stores/useThemeStore'
import { useThemeLibrary } from '@/themes/library'
import { copyTheme, isSemanticTheme, themeLabel } from '@/themes/runtime'
import {
  parseThemeDocument,
  themeDocumentSchema,
  type ThemeDocument,
} from '@markflowy/theme/semantic'
import themeData from '../../../../../../community-themes.json'
import { ThemeEditor } from './ThemeEditor'
import { ThemeListItem, ThemeMenu } from './ThemeListItem'
import { CommunityThemeItem } from './CommunityThemeItem'
import {
  communityThemeQueryOptions,
  ThemeCatalogMismatchError,
  type ThemeItem,
} from './communityThemes'
import { readThemeDrafts, themeDraftKey, type ThemeDraft } from './drafts'
import { useThemeLabels } from './labels'
import { exportJson, readImport } from './files'
import { getSettingGroupAnchorId } from '../settingSearch'
export type { ThemeItem } from './communityThemes'
export interface ThemeStoreProps {
  mode?: MfTheme['mode']
  onBack?: () => void
  onSelected?: () => void
}

export function ThemeStore({ mode, onBack, onSelected }: ThemeStoreProps) {
  const labels = useThemeLabels()
  const queryClient = useQueryClient()
  const library = useThemeLibrary()
  const themes = useThemeStore((state) => state.themes)
  const current = useThemeStore((state) => state.curTheme)
  const lightThemeName = useThemeStore((state) => state.lightThemeName)
  const darkThemeName = useThemeStore((state) => state.darkThemeName)
  const [editing, setEditing] = useState<ThemeDraft>()
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
      })
    }
    return true
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
  const catalogIds = new Set(catalog.map((item) => item.id))
  const isBuiltIn = (theme: MfTheme) =>
    !isSemanticTheme(theme) &&
    builtInThemes.some((item) => item.name === theme.name && item.mode === theme.mode)
  const matchesMode = (theme: MfTheme) => !mode || theme.mode === mode
  const creationTheme = mode
    ? (themes.find(
        (theme) =>
          theme.mode === mode && theme.name === (mode === 'light' ? lightThemeName : darkThemeName),
      ) ??
      themes.find((theme) => theme.mode === mode) ??
      current)
    : current
  const builtIn = themes.filter((theme) => isBuiltIn(theme) && matchesMode(theme))
  const local = themes.filter(
    (theme) =>
      matchesMode(theme) &&
      !isBuiltIn(theme) &&
      !(isSemanticTheme(theme) && catalogIds.has(theme.document.id)),
  )
  const communityThemes = new Map<string, MfTheme[]>()
  for (const theme of themes) {
    if (isSemanticTheme(theme) && catalogIds.has(theme.document.id)) {
      const variants = communityThemes.get(theme.document.id) ?? []
      variants.push(theme)
      communityThemes.set(theme.document.id, variants)
    }
  }
  const visibleCatalog = catalog.filter((item) => {
    const installed = communityThemes.get(item.id)
    return (!installedOnly || installed) && (!installed || installed.some(matchesMode))
  })
  const installTheme = (item: ThemeItem, refresh = false) =>
    void run(async () => {
      try {
        const document = await queryClient.fetchQuery({
          ...communityThemeQueryOptions(item),
          ...(refresh && { staleTime: 0 }),
        })
        const variant =
          mode && !refresh ? document.variants.find((entry) => entry.mode === mode) : undefined
        if (mode && !refresh && !variant) {
          throw new Error(labels[mode === 'light' ? 'noLightVariant' : 'noDarkVariant'])
        }
        if (await persist(document, variant?.id)) {
          if (variant) onSelected?.()
        }
      } catch (cause) {
        if (cause instanceof ThemeCatalogMismatchError) throw new Error(labels.catalogMismatch)
        throw cause
      }
    })
  const renderTheme = (theme: MfTheme, author?: string, catalogItem?: ThemeItem) => (
    <ThemeListItem
      key={theme.name}
      theme={theme}
      current={theme.name === current.name && theme.mode === current.mode}
      selected={theme.name === (theme.mode === 'light' ? lightThemeName : darkThemeName)}
      pending={pending}
      author={author}
      installed={Boolean(catalogItem)}
      onReinstall={catalogItem ? () => installTheme(catalogItem, true) : undefined}
      onApply={() =>
        void run(async () => {
          await useThemeStore.getState().applyThemeSelection({
            [theme.mode === 'light' ? 'lightThemeName' : 'darkThemeName']: theme.name,
          })
          onSelected?.()
        })
      }
      onCopy={() =>
        openEditor(copyTheme(theme), isSemanticTheme(theme) ? theme.variant.id : undefined)
      }
      {...(isSemanticTheme(theme) && {
        onEdit: () => openEditor(structuredClone(theme.document), theme.variant.id),
        onExport: () => void run(() => exportJson(theme.document, `${theme.document.id}.json`)),
        onRemove: () =>
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
          }),
      })}
    />
  )
  return (
    <div className='@container/theme-store space-y-5 text-ui-control'>
      {onBack && (
        <div className='space-y-2'>
          <Button size='sm' variant='ghost' disabled={pending} onClick={onBack}>
            <ArrowLeft aria-hidden className='size-3.5' />
            {labels.backToAppearance}
          </Button>
          <h2
            id={getSettingGroupAnchorId('themeStore', 'ThemeLibrary')}
            tabIndex={-1}
            className='m-0 text-ui-body font-semibold focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-2'
          >
            {mode ? labels[mode === 'light' ? 'chooseLight' : 'chooseDark'] : labels.browseThemes}
          </h2>
          {mode && <p className='m-0 text-muted-foreground'>{labels.preserveMode}</p>}
        </div>
      )}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='m-0 flex min-w-0 items-center gap-2 text-muted-foreground'>
          <Check aria-hidden className='size-4 shrink-0 text-primary' />
          <span>
            {labels.currentTheme}:{' '}
            <span className='font-medium text-foreground'>{themeLabel(current)}</span>
          </span>
        </p>
        <ThemeMenu
          label={labels.tools}
          disabled={pending}
          trigger={
            <>
              {labels.tools}
              <ChevronDown aria-hidden className='size-3.5' />
            </>
          }
        >
          <MenuItem
            onSelect={() =>
              openEditor(
                copyTheme(creationTheme),
                isSemanticTheme(creationTheme) ? creationTheme.variant.id : undefined,
              )
            }
          >
            <Plus aria-hidden className='size-3.5' />
            {labels.create}
          </MenuItem>
          <MenuItem
            onSelect={() =>
              void run(async () => {
                const file = await readImport('json')
                if (file) await persist(parseThemeDocument(JSON.parse(file.text)))
              })
            }
          >
            <Download aria-hidden className='size-3.5' />
            {labels.import}
          </MenuItem>
          <DropdownMenuSeparator />
          <MenuItem
            onSelect={() => void run(() => openUrl('https://github.com/drl990114/MarkFlowy'))}
          >
            <ExternalLink aria-hidden className='size-3.5' />
            {labels.submit}
          </MenuItem>
          <MenuItem
            onSelect={() =>
              void run(() => exportJson(themeDocumentSchema, 'markflowy-theme.schema.json'))
            }
          >
            <FileJson aria-hidden className='size-3.5' />
            {labels.schema}
          </MenuItem>
        </ThemeMenu>
      </div>
      {(error || library.error) && (
        <div role='alert' className='text-destructive'>
          {error || library.error}
          <Button
            size='sm'
            variant='outline'
            disabled={pending}
            onClick={() => void run(library.reload)}
          >
            {labels.retry}
          </Button>
        </div>
      )}
      {drafts.map((draft) => (
        <div
          key={draft.key}
          className='flex flex-wrap items-center gap-2 rounded-md border border-border p-3'
        >
          <span className='min-w-0 flex-1 break-words'>
            {labels.draft} · {draft.session.document.name}
          </span>
          <Button size='sm' variant='outline' disabled={pending} onClick={() => setEditing(draft)}>
            {labels.resume}
          </Button>
          <ThemeMenu label={`${labels.more}: ${draft.session.document.name}`} disabled={pending}>
            <MenuItem
              className='text-destructive'
              onSelect={() => {
                try {
                  sessionStorage.removeItem(draft.key)
                  setDrafts(readThemeDrafts())
                } catch (cause) {
                  setError(String(cause))
                }
              }}
            >
              {labels.discard}
            </MenuItem>
          </ThemeMenu>
        </div>
      ))}
      <section aria-label={labels.builtIn} className='space-y-2'>
        <div className='flex items-center gap-2'>
          <h3 className='m-0 text-ui-control font-semibold'>{labels.builtIn}</h3>
          <span className='text-ui-caption text-muted-foreground'>{builtIn.length}</span>
        </div>
        <p className='m-0 text-ui-caption text-muted-foreground'>{labels.builtInDescription}</p>
        <div className='grid gap-x-4 gap-y-1 @min-[48rem]/theme-store:grid-cols-2'>
          {builtIn.map((theme) => renderTheme(theme))}
        </div>
      </section>
      <section aria-label={labels.catalog} className='space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='m-0 text-ui-control font-semibold'>{labels.catalog}</h3>
          <span className='text-ui-caption text-muted-foreground'>{visibleCatalog.length}</span>
          {catalog.length > 0 && (
            <label className='ml-auto flex cursor-default select-none items-center gap-2 text-ui-caption text-muted-foreground'>
              <Checkbox
                checked={installedOnly}
                disabled={pending}
                onCheckedChange={(value) => setInstalledOnly(value === true)}
              />
              {labels.installedOnly}
            </label>
          )}
        </div>
        {visibleCatalog.length === 0 && (
          <p className='m-0 py-3 text-muted-foreground'>
            {mode && catalog.length > 0
              ? labels.noMatchingThemes
              : installedOnly && catalog.length > 0
                ? labels.noInstalled
                : labels.emptyCatalog}
          </p>
        )}
        <div className='grid gap-x-4 gap-y-1 @min-[48rem]/theme-store:grid-cols-2'>
          {visibleCatalog.map((item) => {
            const installed = communityThemes.get(item.id)
            if (installed)
              return installed
                .filter(matchesMode)
                .map((theme) =>
                  renderTheme(
                    theme,
                    isSemanticTheme(theme) ? theme.document.author || item.author : item.author,
                    item,
                  ),
                )
            return (
              <CommunityThemeItem
                key={item.id}
                item={item}
                mode={mode ?? current.mode}
                selectOnInstall={Boolean(mode)}
                pending={pending}
                onInstall={() => installTheme(item)}
              />
            )
          })}
        </div>
      </section>
      {local.length > 0 && (
        <section aria-label={labels.local} className='space-y-2'>
          <div className='flex items-center gap-2'>
            <h3 className='m-0 text-ui-control font-semibold'>{labels.local}</h3>
            <span className='text-ui-caption text-muted-foreground'>{local.length}</span>
          </div>
          <p className='m-0 text-ui-caption text-muted-foreground'>{labels.localDescription}</p>
          <div className='grid gap-x-4 gap-y-1 @min-[48rem]/theme-store:grid-cols-2'>
            {local.map((theme) =>
              renderTheme(theme, isSemanticTheme(theme) ? (theme.document.author ?? '') : ''),
            )}
          </div>
        </section>
      )}
    </div>
  )
}
