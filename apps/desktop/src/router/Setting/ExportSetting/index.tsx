import { Button } from '@/components/ui/button'
import {
  PANDOC_EXECUTABLE_PATH_SETTING,
  PANDOC_INSTALL_URL,
  probePandoc,
  type PandocInfo,
} from '@/components/EditorArea/pandoc-export/pandocExport'
import {
  PDF_BROWSER_EXECUTABLE_PATH_SETTING,
  probePdfBrowser,
  type PdfBrowserInfo,
} from '@/components/EditorArea/pdf-export/pdfExport'
import { useTranslation } from '@/i18n'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import { SettingItemContainer } from '../component/SettingItems/Container'
import { SettingLabel } from '../component/SettingItems/Label'
import { getSettingGroupAnchorId } from '../settingSearch'

const pandocSettingItem: Setting.BaseSettingItem = {
  key: PANDOC_EXECUTABLE_PATH_SETTING,
  title: { i18nKey: 'settings.export.pandoc.executable.label' },
  desc: { i18nKey: 'settings.export.pandoc.executable.desc' },
}

const pdfBrowserSettingItem: Setting.BaseSettingItem = {
  key: PDF_BROWSER_EXECUTABLE_PATH_SETTING,
  title: { i18nKey: 'settings.export.pdf.executable.label' },
  desc: { i18nKey: 'settings.export.pdf.executable.desc' },
}

function PdfBrowserSetting() {
  const { t } = useTranslation()
  const configuredPath = useAppSettingStore((state) => {
    const value = state.settingData[PDF_BROWSER_EXECUTABLE_PATH_SETTING]
    return typeof value === 'string' ? value : ''
  })
  const [info, setInfo] = useState<PdfBrowserInfo>()
  const [checking, setChecking] = useState(true)
  const [saveError, setSaveError] = useState(false)
  const requestRef = useRef(0)

  const checkBrowser = useCallback(
    async (refresh = false) => {
      const request = ++requestRef.current
      const path = configuredPath.trim()
      const isCurrent = () => {
        const value = useAppSettingStore.getState().settingData[PDF_BROWSER_EXECUTABLE_PATH_SETTING]
        return (
          request === requestRef.current && (typeof value === 'string' ? value.trim() : '') === path
        )
      }
      setChecking(true)
      setInfo(undefined)
      try {
        const result = await probePdfBrowser(path || undefined, refresh)
        if (isCurrent()) setInfo(result)
      } catch {
        if (isCurrent()) setInfo({ available: false, compatible: false })
      } finally {
        if (isCurrent()) setChecking(false)
      }
    },
    [configuredPath],
  )

  useEffect(() => {
    void checkBrowser()
    return () => {
      requestRef.current += 1
    }
  }, [checkBrowser])

  const selectExecutable = async () => {
    setSaveError(false)
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        fileAccessMode: 'scoped',
      })
      if (typeof selected === 'string') {
        await appSettingService.writeSettingData(pdfBrowserSettingItem, selected)
      }
    } catch {
      setSaveError(true)
    }
  }

  const resetToAutomatic = async () => {
    setSaveError(false)
    try {
      await appSettingService.writeSettingData(pdfBrowserSettingItem, '')
    } catch {
      setSaveError(true)
    }
  }

  let status = t('settings.export.pdf.status.not_found')
  if (checking) status = t('settings.export.pdf.status.checking')
  else if (info?.available && info.compatible) {
    status = t('settings.export.pdf.status.ready', { version: info.version ?? '' })
  } else if (configuredPath && info?.error?.code === 'invalid_executable') {
    status = t('settings.export.pdf.status.invalid_executable')
  } else if (info?.available) status = t('settings.export.pdf.status.incompatible')

  return (
    <SettingGroupContainer $anchorId={getSettingGroupAnchorId('export', 'pdf')}>
      <h2 className='setting-group__title'>{t('settings.export.pdf.label')}</h2>
      <div className='setting-group__items'>
        <SettingItemContainer $settingKey={PDF_BROWSER_EXECUTABLE_PATH_SETTING}>
          <SettingLabel item={pdfBrowserSettingItem} />
          <div className='flex w-1/2 min-w-0 flex-col items-end gap-2'>
            <span role='status' className='text-right text-ui-control text-foreground'>
              {status}
            </span>
            {info?.executablePath || configuredPath ? (
              <span className='max-w-full break-all text-right text-ui-caption text-muted-foreground'>
                {info?.executablePath || configuredPath}
              </span>
            ) : null}
            {saveError ? (
              <span role='alert' className='text-right text-ui-caption text-destructive'>
                {t('settings.export.pdf.status.save_failed')}
              </span>
            ) : null}
            <div className='flex flex-wrap justify-end gap-2'>
              <Button size='sm' variant='outline' onClick={() => void selectExecutable()}>
                {t('settings.export.pdf.select')}
              </Button>
              {configuredPath ? (
                <Button size='sm' variant='ghost' onClick={() => void resetToAutomatic()}>
                  {t('settings.export.pdf.automatic')}
                </Button>
              ) : null}
              <Button
                disabled={checking}
                size='sm'
                variant='ghost'
                onClick={() => void checkBrowser(true)}
              >
                {t('settings.export.pdf.check_again')}
              </Button>
            </div>
          </div>
        </SettingItemContainer>
      </div>
    </SettingGroupContainer>
  )
}

export function ExportSetting() {
  const { t } = useTranslation()
  const configuredPath = useAppSettingStore((state) => {
    const value = state.settingData[PANDOC_EXECUTABLE_PATH_SETTING]
    return typeof value === 'string' ? value : ''
  })
  const [info, setInfo] = useState<PandocInfo>()
  const [checking, setChecking] = useState(true)

  const checkPandoc = useCallback(async () => {
    setChecking(true)
    try {
      setInfo(await probePandoc(configuredPath.trim() || undefined))
    } catch {
      setInfo({
        available: false,
        compatible: false,
        supportedFormats: [],
      })
    } finally {
      setChecking(false)
    }
  }, [configuredPath])

  useEffect(() => {
    void checkPandoc()
  }, [checkPandoc])

  const selectExecutable = async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      fileAccessMode: 'scoped',
    })
    if (typeof selected !== 'string') return
    await appSettingService.writeSettingData(pandocSettingItem, selected)
  }

  const resetToAutomatic = async () => {
    await appSettingService.writeSettingData(pandocSettingItem, '')
  }

  let status = t('settings.export.pandoc.status.not_found')
  if (checking) {
    status = t('settings.export.pandoc.status.checking')
  } else if (info?.compatible) {
    status = t('settings.export.pandoc.status.ready', { version: info.version ?? '' })
  } else if (configuredPath && info?.error?.code === 'invalid_executable') {
    status = t('settings.export.pandoc.status.invalid_executable')
  } else if (info?.available) {
    status = t('settings.export.pandoc.status.incompatible')
  }

  return (
    <>
      <PdfBrowserSetting />
      <SettingGroupContainer $anchorId={getSettingGroupAnchorId('export', 'pandoc')}>
        <h2 className='setting-group__title'>{t('settings.export.pandoc.label')}</h2>
        <div className='setting-group__items'>
          <SettingItemContainer $settingKey={PANDOC_EXECUTABLE_PATH_SETTING}>
            <SettingLabel item={pandocSettingItem} />
            <div className='flex w-1/2 min-w-0 flex-col items-end gap-2'>
              <span aria-live='polite' className='text-ui-control text-foreground'>
                {status}
              </span>
              {info?.executablePath ? (
                <span className='max-w-full break-all text-right text-ui-caption text-muted-foreground'>
                  {info.executablePath}
                </span>
              ) : null}
              <div className='flex flex-wrap justify-end gap-2'>
                <Button size='sm' variant='outline' onClick={selectExecutable}>
                  {t('settings.export.pandoc.select')}
                </Button>
                {configuredPath ? (
                  <Button size='sm' variant='ghost' onClick={resetToAutomatic}>
                    {t('settings.export.pandoc.automatic')}
                  </Button>
                ) : null}
                <Button disabled={checking} size='sm' variant='ghost' onClick={checkPandoc}>
                  {t('settings.export.pandoc.check_again')}
                </Button>
                <Button size='sm' variant='ghost' onClick={() => openUrl(PANDOC_INSTALL_URL)}>
                  {t('settings.export.pandoc.install_guide')}
                </Button>
              </div>
            </div>
          </SettingItemContainer>
        </div>
      </SettingGroupContainer>
    </>
  )
}
