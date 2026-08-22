import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { loadLocalThemeCss } from '@/helper/extensions'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import { dialog } from '@/services/dialog'
import useExtensionsManagerStore from '@/stores/useExtensionsManagerStore'
import useThemeStore from '@/stores/useThemeStore'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import themeData from '../../../../../../community-themes.json'

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
  white-space: nowrap;
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
  const { t } = useTranslation()

  const loadLocalThemes = useCallback(async () => {
    try {
      const loadedThemes = await invoke<LocalTheme[]>('load_local_themes')
      setLocalThemes(loadedThemes)
    } catch (error) {
      logger.error('Failed to load local themes:', error)
    }
  }, [])

  useEffect(() => {
    void loadLocalThemes()
  }, [loadLocalThemes])

  const handleImportLocalTheme = async () => {
    try {
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
        const updatedThemes = [...localThemes, newTheme]
        setLocalThemes(updatedThemes)
        loadLocalThemeCss(updatedThemes.map((themeItem) => themeItem.css_content))
      }
    } catch (error) {
      logger.error('Failed to import local theme:', error)
    }
  }

  const handleRemoveLocalTheme = async (localTheme: LocalTheme) => {
    const action = await dialog.confirm({
      title: t('common.delete'),
      content: t('settings.themeStore.remove_local_theme', { name: localTheme.name }),
      actions: [
        { id: 'cancel', label: t('common.cancel') },
        { id: 'confirm', label: t('common.delete'), primary: true, danger: true },
      ],
    })

    if (action !== 'confirm') return

    try {
      await invoke('remove_local_theme', { id: localTheme.id })
      const updatedThemes = localThemes.filter((themeItem) => themeItem.id !== localTheme.id)
      setLocalThemes(updatedThemes)
      loadLocalThemeCss(updatedThemes.map((themeItem) => themeItem.css_content))
    } catch (error) {
      logger.error('Failed to remove local theme:', error)
    }
  }

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

  const handleInstall = async (theme: ThemeItem) => {
    const action = await dialog.confirm({
      title: 'Install Theme',
      content: `Are you sure you want to install ${theme.name}?`,
      actions: [
        { id: 'cancel', label: t('common.cancel') },
        { id: 'confirm', label: t('common.confirm'), primary: true },
      ],
    })

    if (action !== 'confirm') return

    try {
      await invoke('download_theme', { name: theme.packageName })
      const res = await invoke<any[]>('load_themes')
      if (Array.isArray(res)) {
        res.forEach((extension) => {
          useExtensionsManagerStore.getState().loadExtension(extension)
        })
      }
    } catch (error) {
      logger.error('Failed to install theme:', error)
    }
  }

  const handleUninstall = async (theme: ThemeItem) => {
    const action = await dialog.confirm({
      title: 'Uninstall Theme',
      content: `Are you sure you want to uninstall ${theme.name}?`,
      actions: [
        { id: 'cancel', label: t('common.cancel') },
        { id: 'confirm', label: t('common.confirm'), primary: true, danger: true },
      ],
    })

    if (action !== 'confirm') return

    try {
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
    } catch (error) {
      logger.error('Failed to uninstall theme:', error)
    }
  }

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
          <Button type='button' size='sm' variant='outline' onClick={handleImportLocalTheme}>
            {t('common.import')} CSS
          </Button>
        </Toolbar>
        {localThemes.length === 0 ? (
          <EmptyState>{t('settings.themeStore.no_local_themes')}.</EmptyState>
        ) : (
          localThemes.map((localTheme) => (
            <LocalThemeRow key={localTheme.id}>
              <LocalThemeInfo>
                <LocalThemeName>{localTheme.name}</LocalThemeName>
              </LocalThemeInfo>
              <LocalThemeActions>
                <Button
                  type='button'
                  size='sm'
                  variant='destructive'
                  onClick={() => handleRemoveLocalTheme(localTheme)}
                >
                  {t('common.delete')}
                </Button>
              </LocalThemeActions>
            </LocalThemeRow>
          ))
        )}
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
              <TableCell width='20%'>{t('settings.themeStore.name')}</TableCell>
              <TableCell width='10%'>{t('settings.themeStore.mode')}</TableCell>
              <TableCell width='15%'>{t('settings.themeStore.author')}</TableCell>
              <TableCell width='35%'>{t('settings.themeStore.description')}</TableCell>
              <TableCell width='10%'>{t('settings.themeStore.action')}</TableCell>
            </TableRow>
          </TableHead>
          <tbody>
            {filteredThemes.map((theme) => {
              const installed = isInstalled(theme.packageName)
              return (
                <TableRow key={theme.packageName}>
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
                        onClick={() => handleUninstall(theme)}
                      >
                        {t('settings.themeStore.uninstall')}
                      </Button>
                    ) : (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => handleInstall(theme)}
                      >
                        {t('settings.themeStore.download')}
                      </Button>
                    )}
                  </TableDataCell>
                </TableRow>
              )
            })}
          </tbody>
        </Table>
      </TableContainer>
    </ThemeStoreContent>
  )
}
