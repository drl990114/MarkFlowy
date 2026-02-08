import { MODAL_CONFIRM_ID } from '@/components/Modal'
import useExtensionsManagerStore from '@/stores/useExtensionsManagerStore'
import useThemeStore from '@/stores/useThemeStore'
import NiceModal from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import { Button, Checkbox } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import themeData from '../../../../../../community-themes.json'

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

export function ThemeStore() {
  const storeThemes = (themeData || []) as unknown as ThemeItem[]
  const { themes: installedThemes, deleteTheme } = useThemeStore()
  const [onlyInstalled, setOnlyInstalled] = useState(false)
  const { t } = useTranslation()

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
          console.error('Failed to install theme:', error)
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
          console.error('Failed to uninstall theme:', error)
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
  )
}
