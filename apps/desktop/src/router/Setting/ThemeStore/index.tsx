import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AsyncSurface, type AsyncSurfaceState } from '@/components/AsyncSurface'
import { loadLocalThemeCss } from '@/helper/extensions'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import { dialog } from '@/services/dialog'
import useExtensionsManagerStore from '@/stores/useExtensionsManagerStore'
import useThemeStore from '@/stores/useThemeStore'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircleIcon, LoaderCircleIcon } from 'lucide-react'
import styled from 'styled-components'
import themeData from '../../../../../../community-themes.json'
import { useThemeOperations } from './useThemeOperations'

const SectionTitle = styled.h3`
  font-size: var(--mf-ui-font-body);
  font-weight: 600;
  line-height: var(--mf-ui-line-height-body);
  margin: 16px 0 8px;
  color: var(--mf-muted-foreground);

  &:first-child {
    margin-top: 0;
  }
`

const ThemeStoreContent = styled.div`
  min-width: 0;
  max-width: 100%;
`

const LocalThemeContainer = styled.div`
  width: 100%;
  max-width: 100%;
  margin-bottom: 16px;
  overflow: hidden;
  background-color: var(--mf-card);
  border: 1px solid var(--mf-border);
  border-radius: var(--mf-radius);
  box-sizing: border-box;
`

const LocalThemeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--mf-border);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--mf-muted);
  }
`

const LocalThemeInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

const LocalThemeName = styled.span`
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  font-weight: 500;
  color: var(--mf-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const LocalThemeActions = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: 8px;
`

const TableContainer = styled.div`
  width: 100%;
  max-width: 100%;
  margin-bottom: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  background-color: var(--mf-card);
  border: 1px solid var(--mf-border);
  border-radius: var(--mf-radius);
  box-sizing: border-box;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--mf-scrollbar-track);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--mf-scrollbar-thumb);
    border-radius: 4px;
  }
`

const Table = styled.table`
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  font-size: var(--mf-font-sm);
  table-layout: fixed;
`

const TableHead = styled.thead`
  background-color: var(--mf-muted);
`

const TableRow = styled.tr`
  border-bottom: 1px solid var(--mf-border);

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background-color: var(--mf-muted);
  }
`

const TableCell = styled.th<{ width?: string }>`
  width: ${(props) => props.width || 'auto'};
  padding: 7px 10px;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  color: var(--mf-foreground);
  box-sizing: border-box;
`

const TableDataCell = styled.td`
  padding: 7px 10px;
  text-align: left;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  color: var(--mf-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: top;
  overflow-wrap: anywhere;

  &:first-child {
    font-weight: 500;
  }

  &:nth-child(4) {
    color: var(--mf-text-secondary);
  }
`

const Toolbar = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 36px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--mf-border);
  box-sizing: border-box;
`

const InstalledOnlyControl = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--mf-foreground);
  cursor: pointer;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
`

const EmptyState = styled.div`
  padding: 14px 12px;
  color: var(--mf-muted-foreground);
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  text-align: center;
`

export interface ThemeItem {
  name: string
  mode: ('dark' | 'light')[]
  description: string
  packageName: string
  author: string
  repository: string
}

export interface LocalTheme {
  id: string
  name: string
  path: string
  css_content: string
}

export function ThemeStore() {
  const storeThemes = (themeData || []) as unknown as ThemeItem[]
  const { themes: installedThemes, deleteTheme } = useThemeStore()
  const [onlyInstalled, setOnlyInstalled] = useState(false)
  const [localThemes, setLocalThemes] = useState<LocalTheme[]>([])
  const localThemesRef = useRef(localThemes)
  const loadRequest = useRef(0)
  const [localState, setLocalState] = useState<AsyncSurfaceState<true>>({ status: 'loading' })
  const { operations, run } = useThemeOperations()
  const { t } = useTranslation()

  const loadLocalThemes = useCallback(async () => {
    const request = ++loadRequest.current
    setLocalState({ status: 'loading' })
    try {
      const loadedThemes = await invoke<LocalTheme[]>('load_local_themes')
      if (request !== loadRequest.current) return
      localThemesRef.current = loadedThemes
      setLocalThemes(loadedThemes)
      setLocalState({ status: 'ready', data: true })
    } catch (error) {
      if (request !== loadRequest.current) return
      logger.error('Failed to load local themes:', error)
      setLocalState({
        status: 'error',
        title: t('common.error'),
        description: error instanceof Error ? error.message : String(error),
        retry: () => void loadLocalThemes(),
      })
    }
  }, [t])

  useEffect(() => {
    void loadLocalThemes()
    return () => {
      loadRequest.current += 1
    }
  }, [loadLocalThemes])

  const updateLocalThemes = (update: (previous: LocalTheme[]) => LocalTheme[]) => {
    const nextThemes = update(localThemesRef.current)
    localThemesRef.current = nextThemes
    setLocalThemes(nextThemes)
    loadLocalThemeCss(nextThemes.map((themeItem) => themeItem.css_content))
  }

  const handleImportLocalTheme = () =>
    run('import', async () => {
      const selected = await open({
        filters: [
          {
            name: 'CSS',
            extensions: ['css'],
          },
        ],
        fileAccessMode: 'scoped',
      })

      if (selected) {
        const newTheme = await invoke<LocalTheme>('import_local_theme', {
          filePath: selected,
        })
        updateLocalThemes((previous) => [...previous, newTheme])
      }
    })

  const handleRemoveLocalTheme = (localTheme: LocalTheme) =>
    run(
      `local:${localTheme.id}`,
      async () => {
        await invoke('remove_local_theme', { id: localTheme.id })
        updateLocalThemes((previous) =>
          previous.filter((themeItem) => themeItem.id !== localTheme.id),
        )
      },
      async () =>
        (await dialog.confirm({
          title: t('common.delete'),
          content: t('settings.themeStore.remove_local_theme', { name: localTheme.name }),
          actions: [
            { id: 'cancel', label: t('common.cancel') },
            { id: 'confirm', label: t('common.delete'), primary: true, danger: true },
          ],
        })) === 'confirm',
    )

  const isInstalled = (packageName: string) => {
    // Check if theme exists in installed themes by checking if any installed theme matches the name
    // Note: Ideally we should match by package name but current theme store only has name
    return installedThemes.some(
      (installedTheme) =>
        installedTheme.name === packageName ||
        installedTheme.name ===
          storeThemes.find((storeTheme) => storeTheme.packageName === packageName)?.name,
    )
  }

  const handleInstall = (theme: ThemeItem) =>
    run(
      `online:${theme.packageName}`,
      async () => {
        await invoke('download_theme', { name: theme.packageName })
        const res = await invoke<Record<string, unknown>[]>('load_themes')
        if (Array.isArray(res)) {
          res.forEach((extension) => {
            useExtensionsManagerStore.getState().loadExtension(extension)
          })
        }
      },
      async () =>
        (await dialog.confirm({
          title: t('settings.themeStore.install_theme'),
          content: t('settings.themeStore.install_theme_confirm', { name: theme.name }),
          actions: [
            { id: 'cancel', label: t('common.cancel') },
            { id: 'confirm', label: t('common.confirm'), primary: true },
          ],
        })) === 'confirm',
    )

  const handleUninstall = (theme: ThemeItem) =>
    run(
      `online:${theme.packageName}`,
      async () => {
        await invoke('remove_theme', { name: theme.packageName })

        const installedTheme = installedThemes.find(
          (candidateTheme) =>
            candidateTheme.name === theme.packageName || candidateTheme.name === theme.name,
        )

        if (installedTheme) {
          deleteTheme(installedTheme.name)
        } else {
          deleteTheme(theme.name)
          deleteTheme(theme.packageName)
        }
      },
      async () =>
        (await dialog.confirm({
          title: t('settings.themeStore.uninstall_theme'),
          content: t('settings.themeStore.uninstall_theme_confirm', { name: theme.name }),
          actions: [
            { id: 'cancel', label: t('common.cancel') },
            { id: 'confirm', label: t('common.confirm'), primary: true, danger: true },
          ],
        })) === 'confirm',
    )

  const filteredThemes = storeThemes.filter((theme) => {
    if (onlyInstalled) {
      return isInstalled(theme.packageName)
    }
    return true
  })

  return (
    <ThemeStoreContent>
      <SectionTitle>{t('settings.themeStore.local_css_files')}</SectionTitle>
      <LocalThemeContainer>
        <Toolbar>
          <Button
            aria-busy={operations.import?.pending || undefined}
            disabled={localState.status !== 'ready' || operations.import?.pending}
            type='button'
            size='sm'
            variant='outline'
            onClick={handleImportLocalTheme}
          >
            <OperationLabel pending={operations.import?.pending}>
              {t('common.import')} CSS
            </OperationLabel>
          </Button>
        </Toolbar>
        <OperationError error={operations.import?.error} onRetry={handleImportLocalTheme} />
        <AsyncSurface
          retryLabel={t('common.retry')}
          state={
            localState.status === 'loading'
              ? { status: 'loading', label: t('common.fetching') }
              : localState
          }
        >
          {() =>
            localThemes.length === 0 ? (
              <EmptyState role='status'>{t('settings.themeStore.no_local_themes')}</EmptyState>
            ) : (
              localThemes.map((localTheme) => (
                <Fragment key={localTheme.id}>
                  <LocalThemeRow
                    aria-busy={operations[`local:${localTheme.id}`]?.pending || undefined}
                  >
                    <LocalThemeInfo>
                      <LocalThemeName>{localTheme.name}</LocalThemeName>
                    </LocalThemeInfo>
                    <LocalThemeActions>
                      <Button
                        type='button'
                        size='sm'
                        variant='destructive'
                        disabled={operations[`local:${localTheme.id}`]?.pending}
                        onClick={() => handleRemoveLocalTheme(localTheme)}
                      >
                        <OperationLabel pending={operations[`local:${localTheme.id}`]?.pending}>
                          {t('common.delete')}
                        </OperationLabel>
                      </Button>
                    </LocalThemeActions>
                  </LocalThemeRow>
                  <OperationError
                    error={operations[`local:${localTheme.id}`]?.error}
                    onRetry={() => handleRemoveLocalTheme(localTheme)}
                  />
                </Fragment>
              ))
            )
          }
        </AsyncSurface>
      </LocalThemeContainer>

      <SectionTitle>{t('settings.themeStore.online_themes')}</SectionTitle>
      <TableContainer>
        <Toolbar>
          <InstalledOnlyControl htmlFor='theme-store-only-installed'>
            <Checkbox
              id='theme-store-only-installed'
              checked={onlyInstalled}
              onCheckedChange={(checked) => setOnlyInstalled(checked === true)}
            />
            <span>{t('settings.themeStore.only_installed')}</span>
          </InstalledOnlyControl>
        </Toolbar>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width='19%'>{t('settings.themeStore.name')}</TableCell>
              <TableCell width='13%'>{t('settings.themeStore.mode')}</TableCell>
              <TableCell width='15%'>{t('settings.themeStore.author')}</TableCell>
              <TableCell width='37%'>{t('settings.themeStore.description')}</TableCell>
              <TableCell width='16%'>{t('settings.themeStore.action')}</TableCell>
            </TableRow>
          </TableHead>
          <tbody>
            {filteredThemes.map((theme) => {
              const installed = isInstalled(theme.packageName)
              const operation = operations[`online:${theme.packageName}`]
              return (
                <Fragment key={theme.packageName}>
                  <TableRow aria-busy={operation?.pending || undefined}>
                    <TableDataCell>{theme.name}</TableDataCell>
                    <TableDataCell>{theme.mode.join(', ')}</TableDataCell>
                    <TableDataCell>{theme.author}</TableDataCell>
                    <TableDataCell>{theme.description}</TableDataCell>
                    <TableDataCell>
                      {installed ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='destructive'
                          disabled={operation?.pending}
                          onClick={() => handleUninstall(theme)}
                        >
                          <OperationLabel pending={operation?.pending}>
                            {t('settings.themeStore.uninstall')}
                          </OperationLabel>
                        </Button>
                      ) : (
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          disabled={operation?.pending}
                          onClick={() => handleInstall(theme)}
                        >
                          <OperationLabel pending={operation?.pending}>
                            {t('settings.themeStore.download')}
                          </OperationLabel>
                        </Button>
                      )}
                    </TableDataCell>
                  </TableRow>
                  {operation?.error ? (
                    <tr>
                      <td colSpan={5}>
                        <OperationError
                          error={operation.error}
                          onRetry={() =>
                            installed ? handleUninstall(theme) : handleInstall(theme)
                          }
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
            {filteredThemes.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState role='status'>{t('search.search_empty')}</EmptyState>
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </TableContainer>
    </ThemeStoreContent>
  )
}

function OperationLabel({ pending, children }: { pending?: boolean; children: ReactNode }) {
  return (
    <span className='relative inline-flex items-center justify-center'>
      <span className={pending ? 'opacity-0' : undefined}>{children}</span>
      {pending ? (
        <LoaderCircleIcon
          aria-hidden='true'
          className='absolute size-3.5 animate-spin motion-reduce:animate-none'
        />
      ) : null}
    </span>
  )
}

function OperationError({ error, onRetry }: { error?: string; onRetry: () => void }) {
  const { t } = useTranslation()
  if (!error) return null
  return (
    <div
      className='flex min-w-0 items-start gap-2 border-t border-border bg-destructive/5 px-3 py-2 text-ui-caption'
      role='alert'
    >
      <AlertCircleIcon aria-hidden='true' className='mt-px size-3.5 shrink-0 text-destructive' />
      <span className='min-w-0 flex-1 break-words text-content-secondary'>{error}</span>
      <Button className='shrink-0' onClick={onRetry} size='sm' variant='outline'>
        {t('common.retry')}
      </Button>
    </div>
  )
}
