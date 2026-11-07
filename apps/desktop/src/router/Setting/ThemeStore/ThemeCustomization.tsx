import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenuItemPrimitive as MenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import useAppSettingStore from '@/stores/useAppSettingStore'
import appSettingService from '@/services/app-setting'
import { useThemeLibrary, type CssSnippet } from '@/themes/library'
import { ThemeMenu } from './ThemeListItem'
import { readImport } from './files'
import { useThemeLabels } from './labels'
import { CssSnippetEditor } from './CssSnippetEditor'

export function ThemeCustomization() {
  const labels = useThemeLabels()
  const library = useThemeLibrary()
  const personalTypography = useAppSettingStore(
    (state) => state.settingData.theme_use_personal_typography !== false,
  )
  const [snippet, setSnippet] = useState<CssSnippet>()
  const [error, setError] = useState('')
  const lock = useRef(false)
  const [pending, setPending] = useState(false)
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
  return (
    <div className='text-ui-control'>
      {(error || library.error) && (
        <div role='alert' className='text-destructive'>
          {error || library.error}
          <Button size='sm' variant='outline' disabled={pending} onClick={() => void run(reload)}>
            {labels.retry}
          </Button>
        </div>
      )}
      <details className='group border-t border-border pt-3'>
        <summary className='flex cursor-default select-none list-none items-center gap-2 rounded-sm py-1 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden'>
          <ChevronRight aria-hidden className='size-3.5 group-open:rotate-90' />
          <span className='font-medium'>{labels.customization}</span>
          {library.snippets.length > 0 && <Badge size='sm'>{library.snippets.length}</Badge>}
        </summary>
        <div className='space-y-4 pt-3'>
          <label className='flex cursor-default select-none items-center gap-2'>
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
          <section className='space-y-2' aria-label={labels.snippets}>
            <div className='flex flex-wrap items-center gap-2'>
              <h3 className='m-0 flex-1 text-ui-control font-semibold'>{labels.snippets}</h3>
              <Button
                size='sm'
                variant='outline'
                disabled={pending}
                onClick={() =>
                  setSnippet({
                    id: crypto.randomUUID(),
                    name: labels.untitledCss,
                    css: '',
                    enabled: true,
                  })
                }
              >
                <Plus aria-hidden className='size-3.5' />
                {labels.createCss}
              </Button>
              <ThemeMenu label={`${labels.more}: ${labels.snippets}`} disabled={pending}>
                <MenuItem
                  onSelect={() =>
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
                </MenuItem>
                <MenuItem
                  disabled={!library.snippets.some((item) => item.enabled)}
                  onSelect={() => void run(() => library.mutate({ type: 'disableSnippets' }))}
                >
                  {labels.disableAll}
                </MenuItem>
              </ThemeMenu>
            </div>
            {!library.snippets.length && (
              <p className='text-muted-foreground'>{labels.noSnippets}</p>
            )}
            {library.snippets.map((item, index) => (
              <div
                key={item.id}
                className='flex min-h-9 flex-wrap items-center gap-2 border-b border-border py-1 last:border-b-0'
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
                  disabled={pending}
                  onClick={() => setSnippet({ ...item })}
                >
                  {labels.editCss}
                </Button>
                <ThemeMenu label={`${labels.more}: ${item.name}`} disabled={pending}>
                  <MenuItem
                    disabled={index === 0}
                    onSelect={() =>
                      void run(() =>
                        library.mutate({ type: 'moveSnippet', id: item.id, offset: -1 }),
                      )
                    }
                  >
                    {labels.up}
                  </MenuItem>
                  <MenuItem
                    disabled={index === library.snippets.length - 1}
                    onSelect={() =>
                      void run(() =>
                        library.mutate({ type: 'moveSnippet', id: item.id, offset: 1 }),
                      )
                    }
                  >
                    {labels.down}
                  </MenuItem>
                  <DropdownMenuSeparator />
                  <MenuItem
                    className='text-destructive'
                    onSelect={() =>
                      void run(() => library.mutate({ type: 'removeSnippet', id: item.id }))
                    }
                  >
                    {labels.remove}
                  </MenuItem>
                </ThemeMenu>
              </div>
            ))}
            {snippet && (
              <CssSnippetEditor
                snippet={snippet}
                snippets={library.snippets}
                pending={pending}
                onChange={setSnippet}
                onSave={() =>
                  void run(async () => {
                    await library.mutate({ type: 'saveSnippet', snippet })
                    setSnippet(undefined)
                  })
                }
                onCancel={() => setSnippet(undefined)}
                onOpenReference={() =>
                  void run(() => {
                    const language = String(useAppSettingStore.getState().settingData.language)
                    const locale = language === 'cn' || language.startsWith('zh') ? '/zh' : ''
                    return openUrl(
                      `https://www.markflowy.cc${locale}/docs/Extension/CustomTheme#editor-css-selectors`,
                    )
                  })
                }
              />
            )}
          </section>
        </div>
      </details>
    </div>
  )
}
