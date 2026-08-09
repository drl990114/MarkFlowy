import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { OpenSettingTarget } from '@/extensions/ai/aiProvidersService'
import { installUpdate } from '@/helper/updater'
import type { SettingData } from '@/router/Setting/settingMap'
import { getSettingMap } from '@/router/Setting/settingMap'
import { appSettingStoreSetup } from '@/services/app-setting'
import { dialog } from '@/services/dialog'
import useAppInfoStore from '@/stores/useAppInfoStore'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { Update } from '@tauri-apps/plugin-updater'
import { check } from '@tauri-apps/plugin-updater'
import classNames from 'classnames'
import { ArrowLeft, Search } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from '@/i18n'
import { toast } from 'zens'
import SettingGroup from './component/SettingGroup'
import { CopilotSetting } from './CopilotSetting'
import { ImageSetting } from './ImageSetting'
import { KeyboardTable } from './KeyboardTable'
import { Support } from './Support'
import { ThemeSetting } from './ThemeSetting'
import { ThemeStore } from './ThemeStore'

function isSettingGroup(
  group: Setting.SettingGroup | Setting.SettingItem,
): group is Setting.SettingGroup {
  return typeof group === 'object'
}

function collectI18nKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys

  if (Array.isArray(value)) {
    value.forEach((item) => collectI18nKeys(item, keys))
    return keys
  }

  Object.entries(value).forEach(([key, item]) => {
    if (key === 'i18nKey' && typeof item === 'string') keys.add(item)
    else collectI18nKeys(item, keys)
  })

  return keys
}

export interface SettingNavigationRequest {
  id: number
  target?: OpenSettingTarget
}

interface SettingProps {
  navigationRequest?: SettingNavigationRequest
}

function Setting({ navigationRequest }: SettingProps) {
  const { appInfo } = useAppInfoStore()
  const { t } = useTranslation()
  const [update, setUpdate] = useState<Update | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const settingMap = getSettingMap()

  const handleResetConfiguration = async () => {
    const action = await dialog.confirm({
      title: t('settings.resetAppConf.desc'),
      actions: [
        { id: 'cancel', label: t('common.cancel') },
        { id: 'confirm', label: t('common.confirm'), primary: true, danger: true },
      ],
    })

    if (action !== 'confirm') return

    invoke('reset_app_conf')
      .then(async () => {
        await appSettingStoreSetup()
        toast.success(t('settings.resetAppConf.success'))
      })
      .catch((err: any) => {
        toast.error(String(err))
      })
  }

  const settingDataGroupsKeys = Object.keys(settingMap).filter(
    (key) => key !== 'i18nKey',
  ) as (keyof typeof settingMap)[]
  type SettingCategoryKey = Exclude<keyof SettingData, 'i18nKey' | 'iconName' | 'desc'>
  const [curGroupKey, setCurGroupKey] = useState<SettingCategoryKey>(
    navigationRequest?.target?.category ?? (settingDataGroupsKeys[0] as SettingCategoryKey),
  )
  const value = settingDataGroupsKeys.indexOf(curGroupKey)
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleGroupKeys = normalizedSearchQuery
    ? settingDataGroupsKeys.filter((groupKey) => {
        const group = settingMap[groupKey]
        return Array.from(collectI18nKeys(group)).some((i18nKey) =>
          t(i18nKey).toLocaleLowerCase().includes(normalizedSearchQuery),
        )
      })
    : settingDataGroupsKeys
  const curGroup = settingMap[curGroupKey] as Setting.SettingGroup
  const curGroupKeys = Object.keys(curGroup).filter(
    (key) => key !== 'i18nKey' && key !== 'iconName' && key !== 'desc',
  )

  useEffect(() => {
    check().then((u) => {
      setUpdate(u)
    })
  }, [])

  const renderCurrentSettingData = () => {
    if (curGroupKey === 'keyboard') {
      return <KeyboardTable />
    }

    if (curGroupKey === 'themeStore') {
      return <ThemeStore />
    }

    if (curGroupKey === 'image') {
      return <ImageSetting />
    }

    if (curGroupKey === 'support') {
      return <Support />
    }

    if (curGroupKey === 'copilot') {
      return <CopilotSetting />
    }

    return curGroupKeys.map((key) => {
      const group = curGroup[key]
      if (key === 'Theme' && curGroupKey === 'display') {
        return <ThemeSetting key={key} />
      }
      if (isSettingGroup(group)) {
        return (
          <SettingGroup
            key={key}
            group={group}
            groupKey={key}
            categoryKey={curGroupKey}
            activeChildId={curGroupKey === 'ai' ? navigationRequest?.target?.providerId : undefined}
          />
        )
      }
    })
  }

  const handleOpenThemeStoreFile = () => {
    openUrl('https://github.com/drl990114/MarkFlowy')
  }

  const renderAction = () => {
    if (curGroupKey === 'themeStore') {
      return (
        <Button size='sm' onClick={handleOpenThemeStoreFile}>
          <i aria-hidden className='ri-github-fill' />
          {t('settings.themeStore.submit_theme')}
        </Button>
      )
    }

    if (curGroupKey === 'general') {
      return (
        <Button size='sm' variant='destructive' onClick={handleResetConfiguration}>
          <i aria-hidden className='ri-restart-line' />
          {t('settings.resetAppConf.label')}
        </Button>
      )
    }
  }

  return (
    <div className='box-border flex h-screen w-screen min-w-0 overflow-hidden bg-background text-foreground'>
      <aside className='box-border flex w-[15.5rem] shrink-0 flex-col border-r border-border bg-muted/50 max-lg:w-[14rem] max-md:w-[12.5rem]'>
        <div className='shrink-0 px-3 pt-4 pb-3'>
          <Button
            asChild
            className='w-full justify-start px-2 font-normal text-muted-foreground shadow-none'
            variant='ghost'
          >
            <Link to='/'>
              <ArrowLeft aria-hidden className='size-4' />
              {t('settings.back_to_app')}
            </Link>
          </Button>
          <label className='sr-only' htmlFor='setting-search'>
            {t('settings.search_placeholder')}
          </label>
          <div className='relative mt-3'>
            <Search
              aria-hidden
              className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
            />
            <Input
              className='h-9 rounded-lg bg-background/80 pl-9 shadow-none'
              id='setting-search'
              placeholder={t('settings.search_placeholder')}
              type='search'
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>
        <nav aria-label={t('settings.label')} className='min-h-0 flex-1 overflow-y-auto px-3 py-2'>
          <div className='px-2 pb-2 text-xs font-medium text-muted-foreground'>
            {t('settings.label')}
          </div>
          <ul className='m-0 list-none p-0'>
            {visibleGroupKeys.map((groupKey) => {
              const group = settingMap[groupKey] as Setting.SettingGroup
              const index = settingDataGroupsKeys.indexOf(groupKey)
              return (
                <li key={groupKey}>
                  <Button
                    aria-current={index === value ? 'page' : undefined}
                    className={classNames(
                      'my-0.5 w-full justify-start gap-2 rounded-md px-2.5 text-left font-normal text-foreground shadow-none focus-visible:ring-offset-0',
                      index === value
                        ? 'bg-accent font-medium text-accent-foreground hover:bg-accent'
                        : 'bg-transparent hover:bg-accent/70 hover:text-accent-foreground',
                    )}
                    variant='ghost'
                    onClick={() => setCurGroupKey(groupKey as SettingCategoryKey)}
                  >
                    <i aria-hidden className={classNames(group.iconName, 'text-base')} />
                    <span className='min-w-0 truncate'>{t(group.i18nKey)}</span>
                  </Button>
                </li>
              )
            })}
            {visibleGroupKeys.length === 0 ? (
              <li className='px-2 py-6 text-center text-sm text-muted-foreground' role='status'>
                {t('settings.search_empty')}
              </li>
            ) : null}
          </ul>
        </nav>
        <footer className='shrink-0 border-t border-border px-4 py-3 text-xs text-muted-foreground'>
          {appInfo.version ? (
            <div className='mb-2'>
              {t('about.version')}: {appInfo.version}
            </div>
          ) : null}
          {update ? (
            <Button
              className='h-auto w-full justify-start py-2 text-left whitespace-normal'
              size='sm'
              onClick={() => {
                installUpdate(update)
                setUpdate(null)
              }}
            >
              {t('about.install')}
              {t('about.newVersion')}: {update.version}
            </Button>
          ) : null}
        </footer>
      </aside>
      <main className='box-border min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background'>
        <div className='box-border mx-auto w-full max-w-[56rem] px-8 pt-10 pb-16 max-lg:px-6 max-md:px-5 max-md:pt-8'>
          <header className='mb-7 flex items-start justify-between gap-5'>
            <div className='min-w-0'>
              <h1 className='m-0 text-2xl font-semibold text-foreground'>{t(curGroup.i18nKey)}</h1>
              <p className='mt-2 mb-0 text-sm leading-relaxed text-muted-foreground'>
                {t(curGroup.desc?.i18nKey)}
              </p>
            </div>
            <div className='flex shrink-0 items-center gap-2'>{renderAction()}</div>
          </header>
          <div className='min-w-0'>{renderCurrentSettingData()}</div>
        </div>
      </main>
    </div>
  )
}

export default memo(Setting)
