import { MODAL_CONFIRM_ID } from '@/components/Modal'
import { loadLocalThemeCss } from '@/helper/extensions'
import { logger } from '@/helper/logger'
import useExtensionsManagerStore from '@/stores/useExtensionsManagerStore'
import useThemeStore from '@/stores/useThemeStore'
import NiceModal from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Button, Checkbox } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import themeData from '../../../../../../community-themes.json'

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  margin: 16px 0 12px;
  color: ${(props) => props.theme.labelFontColor};
`

const LocalThemeContainer = styled.div`
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: 8px;
  overflow: auto;
  background-color: ${(props) => props.theme.bgColor};
  margin-bottom: 16px;
`

const LocalThemeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid ${(props) => props.theme.borderColor};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${(props) => props.theme.tipsBgColor};
  }
`

const LocalThemeInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const LocalThemeName = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${(props) => props.theme.labelFontColor};
`

const LocalThemeActions = styled.div`
  display: flex;
  gap: 8px;
`

const TableContainer = styled.div`
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: 8px;
  overflow: auto;
  background-color: ${(props) => props.theme.bgColor};
  margin-bottom: 16px;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${(props) => props.theme.tipsBgColor};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${(props) => props.theme.borderColor};
    border-radius: 4px;
  }
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${(props) => props.theme.fontSm};
  table-layout: fixed;
`

const TableHead = styled.thead`
  background-color: ${(props) => props.theme.tipsBgColor};
`

const TableRow = styled.tr`
  border-bottom: 1px solid ${(props) => props.theme.borderColor};

  &:hover {
    background-color: ${(props) => props.theme.tipsBgColor};
  }
`

const TableCell = styled.th<{ width?: string }>`
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
  font-size: 13px;
  width: ${(props) => props.width || 'auto'};
`

const TableDataCell = styled.td`
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
`

const Toolbar = styled.div`
  padding: 8px 12px;
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  display: flex;
  justify-content: flex-end;
  align-items: center;
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

  useEffect(() => {
    loadLocalThemes()
  }, [])

  const loadLocalThemes = async () => {
    try {
      const themes = await invoke<LocalTheme[]>('load_local_themes')
      setLocalThemes(themes)
    } catch (error) {
      logger.error('Failed to load local themes:', error)
    }
  }

  const handleImportLocalTheme = async () => {
    try {
      const selected = await open({
        filters: [
          {
            name: 'CSS',
            extensions: ['css'],
          },
        ],
      })

      if (selected) {
        const newTheme = await invoke<LocalTheme>('import_local_theme', {
          filePath: selected,
        })
        const updatedThemes = [...localThemes, newTheme]
        setLocalThemes(updatedThemes)
        loadLocalThemeCss(updatedThemes.map((t) => t.css_content))
      }
    } catch (error) {
      logger.error('Failed to import local theme:', error)
    }
  }

  const handleRemoveLocalTheme = async (localTheme: LocalTheme) => {
    NiceModal.show(MODAL_CONFIRM_ID, {
      title: t('common.delete'),
      content: t('settings.themeStore.remove_local_theme', { name: localTheme.name }),
      onConfirm: async () => {
        try {
          await invoke('remove_local_theme', { id: localTheme.id })
          const updatedThemes = localThemes.filter((t) => t.id !== localTheme.id)
          setLocalThemes(updatedThemes)
          loadLocalThemeCss(updatedThemes.map((t) => t.css_content))
        } catch (error) {
          logger.error('Failed to remove local theme:', error)
        }
      },
    })
  }

  const isInstalled = (packageName: string) => {
    // Check if theme exists in installed themes by checking if any installed theme matches the name
    // Note: Ideally we should match by package name but current theme store only has name
    return installedThemes.some(
      (t: any) =>
        t.name === packageName ||
        t.name === storeThemes.find((st) => st.packageName === packageName)?.name,
    )
  }

  const handleInstall = async (theme: ThemeItem) => {
    NiceModal.show(MODAL_CONFIRM_ID, {
      title: 'Install Theme',
      content: `Are you sure you want to install ${theme.name}?`,
      onConfirm: async () => {
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
      },
    })
  }

  const handleUninstall = async (theme: ThemeItem) => {
    NiceModal.show(MODAL_CONFIRM_ID, {
      title: 'Uninstall Theme',
      content: `Are you sure you want to uninstall ${theme.name}?`,
      onConfirm: async () => {
        try {
          await invoke('remove_theme', { name: theme.packageName })
          
          // Find the theme name in installedThemes to delete it from store
          const installedTheme = installedThemes.find(
            (t: any) =>
              t.name === theme.packageName ||
              t.name === theme.name
          )
          
          if (installedTheme) {
            deleteTheme(installedTheme.name)
          } else {
             // Fallback: try to delete by name and packageName just in case
             deleteTheme(theme.name)
             deleteTheme(theme.packageName)
          }
          
        } catch (error) {
          logger.error('Failed to uninstall theme:', error)
        }
      },
    })
  }

  const filteredThemes = storeThemes.filter((theme) => {
    if (onlyInstalled) {
      return isInstalled(theme.packageName)
    }
    return true
  })

  return (
    <div>
      <SectionTitle>{t('settings.themeStore.local_css_files')}</SectionTitle>
      <LocalThemeContainer>
        <Toolbar>
          <Button size='small' onClick={handleImportLocalTheme}>
            {t('common.import')} CSS
          </Button>
        </Toolbar>
        {localThemes.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#888' }}>
            {t('settings.themeStore.no_local_themes')}.
          </div>
        ) : (
          localThemes.map((localTheme) => (
            <LocalThemeRow key={localTheme.id}>
              <LocalThemeInfo>
                <LocalThemeName>{localTheme.name}</LocalThemeName>
              </LocalThemeInfo>
              <LocalThemeActions>
                <Button
                  size='small'
                  danger
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
          <Checkbox checked={onlyInstalled} onChange={(e) => setOnlyInstalled(e.target.checked)}>
            {t('settings.themeStore.only_installed')}
          </Checkbox>
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
                    <Button size='small' danger onClick={() => handleUninstall(theme)}>
                      {t('settings.themeStore.uninstall')}
                    </Button>
                  ) : (
                    <Button size='small' onClick={() => handleInstall(theme)}>
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
    </div>
  )
}
