import { Button } from '@/components/ui/button'
import {
  PANDOC_EXECUTABLE_PATH_SETTING,
  PANDOC_INSTALL_URL,
  probePandoc,
  type PandocInfo,
} from '@/components/EditorArea/pandoc-export/pandocExport'
import { useTranslation } from '@/i18n'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useCallback, useEffect, useState } from 'react'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import { SettingItemContainer } from '../component/SettingItems/Container'
import { SettingLabel } from '../component/SettingItems/Label'
import { getSettingGroupAnchorId } from '../settingSearch'

const pandocSettingItem: Setting.BaseSettingItem = {
  key: PANDOC_EXECUTABLE_PATH_SETTING,
  title: { i18nKey: 'settings.export.pandoc.executable.label' },
  desc: { i18nKey: 'settings.export.pandoc.executable.desc' },
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
    <SettingGroupContainer $anchorId={getSettingGroupAnchorId('export', 'pandoc')}>
      <div className='setting-group__title'>{t('settings.export.pandoc.label')}</div>
      <SettingItemContainer $settingKey={PANDOC_EXECUTABLE_PATH_SETTING}>
        <SettingLabel item={pandocSettingItem} />
        <div className='flex w-1/2 min-w-0 flex-col items-end gap-2 max-[720px]:w-full max-[720px]:items-start'>
          <span aria-live='polite' className='text-ui-control text-foreground'>
            {status}
          </span>
          {info?.executablePath ? (
            <span className='max-w-full break-all text-right text-ui-caption text-muted-foreground max-[720px]:text-left'>
              {info.executablePath}
            </span>
          ) : null}
          <div className='flex flex-wrap justify-end gap-2 max-[720px]:justify-start'>
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
    </SettingGroupContainer>
  )
}
