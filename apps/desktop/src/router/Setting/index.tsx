import Logo from '@/assets/logo.svg?react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { OpenSettingTarget } from '@/extensions/ai/aiProvidersService'
import { installUpdate } from '@/helper/updater'
import { useTranslation } from '@/i18n'
import { appSettingStoreSetup } from '@/services/app-setting'
import { dialog } from '@/services/dialog'
import useAppInfoStore from '@/stores/useAppInfoStore'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { Update } from '@tauri-apps/plugin-updater'
import { check } from '@tauri-apps/plugin-updater'
import classNames from 'classnames'
import { ArrowLeft, Search } from 'lucide-react'
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'zens'
import SettingGroup from './component/SettingGroup'
import { CopilotSetting } from './CopilotSetting'
import { ExportSetting } from './ExportSetting'
import { ImageSetting } from './ImageSetting'
import { KeyboardTable } from './KeyboardTable'
import { getSettingMap } from './settingMap'
import {
  createSettingSearchIndex,
  filterSettingSearchEntries,
  getSettingGroupAnchorId,
  getSettingSearchPath,
  type SettingCategoryKey,
  type SettingSearchEntry,
} from './settingSearch'
import { Support } from './Support'
import { ThemeSetting } from './ThemeSetting'
import { ThemeStore } from './ThemeStore'

const NARROW_SETTINGS_QUERY = '(max-width: 719px)'

function isSettingGroup(
  group: Setting.SettingGroup | Setting.SettingItem,
): group is Setting.SettingGroup {
  return typeof group === 'object'
}

const isNarrowSettingsViewport = () =>
  typeof window !== 'undefined' && window.matchMedia?.(NARROW_SETTINGS_QUERY).matches

const getNavigationItemId = (prefix: string, value: string) =>
  `${prefix}-${value.replace(/[^a-zA-Z0-9_-]+/g, '-')}`

interface SettingFocusTarget {
  categoryKey: SettingCategoryKey
  groupKey?: string
  childId?: string
  settingKey?: string
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
  const settingMap = useMemo(() => getSettingMap(), [])
  const settingDataGroupsKeys = Object.keys(settingMap) as SettingCategoryKey[]
  const initialCategory =
    navigationRequest?.target?.category ?? (settingDataGroupsKeys[0] as SettingCategoryKey)

  const [update, setUpdate] = useState<Update | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [curGroupKey, setCurGroupKey] = useState<SettingCategoryKey>(initialCategory)
  const [activeChildId, setActiveChildId] = useState<string | undefined>(
    navigationRequest?.target?.providerId,
  )
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(navigationRequest?.target))
  const [mobileReturnFocusId, setMobileReturnFocusId] = useState<string>()
  const [pendingFocusTarget, setPendingFocusTarget] = useState<SettingFocusTarget>()
  const [selectedSearchEntryId, setSelectedSearchEntryId] = useState<string>()
  const categoryHeadingRef = useRef<HTMLHeadingElement>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const normalizedSearchQuery = deferredSearchQuery.trim()
  const searchEntries = useMemo(() => createSettingSearchIndex(settingMap), [settingMap])
  const selectedSearchEntry = selectedSearchEntryId
    ? searchEntries.find((entry) => entry.id === selectedSearchEntryId)
    : undefined
  const searchResults = normalizedSearchQuery
    ? filterSettingSearchEntries(searchEntries, normalizedSearchQuery, t)
    : []

  const value = settingDataGroupsKeys.indexOf(curGroupKey)
  const curGroup = settingMap[curGroupKey] as Setting.SettingGroup
  const curGroupKeys = Object.keys(curGroup).filter(
    (key) => key !== 'i18nKey' && key !== 'iconName' && key !== 'desc',
  )

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

  useEffect(() => {
    check().then((nextUpdate) => {
      setUpdate(nextUpdate)
    })
  }, [])

  useEffect(() => {
    const target = navigationRequest?.target
    if (!target) return

    setCurGroupKey(target.category)
    setActiveChildId(target.providerId)
    setMobileDetailOpen(true)
    setPendingFocusTarget({
      categoryKey: target.category,
      groupKey: target.providerId ? 'model' : undefined,
      childId: target.providerId,
    })
  }, [navigationRequest])

  useEffect(() => {
    if (!pendingFocusTarget || pendingFocusTarget.categoryKey !== curGroupKey) return

    const frame = requestAnimationFrame(() => {
      const settingItem = pendingFocusTarget.settingKey
        ? Array.from(document.querySelectorAll<HTMLElement>('[data-setting-key]')).find(
            (element) => element.dataset.settingKey === pendingFocusTarget.settingKey,
          )
        : undefined
      const settingControl = settingItem?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), button:not([disabled]), [role="switch"], [role="slider"], [tabindex]:not([tabindex="-1"])',
      )
      const group = pendingFocusTarget.groupKey
        ? document.getElementById(
            getSettingGroupAnchorId(
              pendingFocusTarget.categoryKey,
              pendingFocusTarget.groupKey,
              pendingFocusTarget.childId,
            ),
          )
        : undefined
      const focusTarget = settingControl ?? settingItem ?? group ?? categoryHeadingRef.current
      const scrollTarget = settingItem ?? group ?? categoryHeadingRef.current

      scrollTarget?.scrollIntoView?.({ behavior: 'auto', block: 'center' })
      focusTarget?.focus({ preventScroll: true })
      setPendingFocusTarget(undefined)
    })

    return () => cancelAnimationFrame(frame)
  }, [activeChildId, curGroupKey, pendingFocusTarget])

  const closeMobileDetail = useCallback(() => {
    setMobileDetailOpen(false)
    requestAnimationFrame(() => {
      if (mobileReturnFocusId) document.getElementById(mobileReturnFocusId)?.focus()
    })
  }, [mobileReturnFocusId])

  useEffect(() => {
    if (!mobileDetailOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        !isNarrowSettingsViewport()
      ) {
        return
      }

      event.preventDefault()
      closeMobileDetail()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeMobileDetail, mobileDetailOpen])

  const handleCategorySelect = (groupKey: SettingCategoryKey, navigationItemId: string) => {
    setCurGroupKey(groupKey)
    setActiveChildId(undefined)
    setSelectedSearchEntryId(undefined)
    setMobileReturnFocusId(navigationItemId)

    if (isNarrowSettingsViewport()) {
      setMobileDetailOpen(true)
      setPendingFocusTarget({ categoryKey: groupKey })
    }
  }

  const handleSearchResultSelect = (entry: SettingSearchEntry, navigationItemId: string) => {
    setCurGroupKey(entry.categoryKey)
    setActiveChildId(entry.childId)
    setSelectedSearchEntryId(entry.id)
    setMobileReturnFocusId(navigationItemId)
    setMobileDetailOpen(true)
    setPendingFocusTarget({
      categoryKey: entry.categoryKey,
      groupKey: entry.groupKey,
      childId: entry.childId,
      settingKey: entry.settingKey,
    })
  }

  const renderCurrentSettingData = () => {
    if (curGroupKey === 'keyboard') return <KeyboardTable />
    if (curGroupKey === 'themeStore') return <ThemeStore />
    if (curGroupKey === 'image') return <ImageSetting />
    if (curGroupKey === 'export') return <ExportSetting />
    if (curGroupKey === 'support') return <Support />
    if (curGroupKey === 'copilot') return <CopilotSetting />

    return curGroupKeys.map((key) => {
      const group = curGroup[key]
      if (key === 'Theme' && curGroupKey === 'display') {
        return <ThemeSetting key={key} revealedSettingKey={selectedSearchEntry?.settingKey} />
      }
      if (isSettingGroup(group)) {
        return (
          <SettingGroup
            activeChildId={curGroupKey === 'ai' ? activeChildId : undefined}
            categoryKey={curGroupKey}
            group={group}
            groupKey={key}
            key={`${key}:${curGroupKey === 'ai' ? (activeChildId ?? '') : ''}`}
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
    <div className='box-border flex h-full w-full min-w-0 overflow-hidden bg-background text-foreground'>
      <aside
        className={classNames(
          'box-border flex w-full shrink-0 flex-col border-border bg-muted/50 min-[720px]:w-[15.5rem] min-[720px]:border-r max-lg:min-[720px]:w-56',
          mobileDetailOpen && 'max-[719px]:hidden',
        )}
      >
        <div className='shrink-0 px-3 pt-3 pb-2'>
          <Button
            asChild
            className='h-7 w-full justify-start px-2 text-ui-control font-normal text-muted-foreground shadow-none'
            variant='ghost'
          >
            <Link className='no-underline' to='/'>
              <ArrowLeft aria-hidden className='size-4' />
              {t('settings.back_to_app')}
            </Link>
          </Button>
          <label className='sr-only' htmlFor='setting-search'>
            {t('settings.search_placeholder')}
          </label>
          <div className='relative mt-2'>
            <Search
              aria-hidden
              className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground'
            />
            <Input
              autoComplete='off'
              className='h-7 rounded-md bg-background/80 pl-8 text-ui-control leading-[var(--mf-ui-line-height-control)] shadow-none'
              id='setting-search'
              name='settings-search'
              placeholder={t('settings.search_placeholder')}
              spellCheck={false}
              type='search'
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>
        <nav aria-label={t('settings.label')} className='min-h-0 flex-1 overflow-y-auto px-3 py-1'>
          <div
            aria-live='polite'
            className='px-2 pt-1 pb-1.5 text-ui-control font-medium text-muted-foreground'
          >
            {normalizedSearchQuery
              ? t('settings.search_results', { count: searchResults.length })
              : t('settings.label')}
          </div>
          <ul className='m-0 list-none p-0'>
            {normalizedSearchQuery
              ? searchResults.map((entry) => {
                  const navigationItemId = getNavigationItemId('setting-search-result', entry.id)
                  const path = [t('settings.label'), ...getSettingSearchPath(entry, t)]

                  return (
                    <li key={entry.id}>
                      <Button
                        aria-current={selectedSearchEntryId === entry.id ? 'location' : undefined}
                        className={classNames(
                          'my-px h-auto min-h-10 w-full flex-col items-start gap-0 rounded-md px-2 py-1.5 text-left font-normal text-foreground shadow-none focus-visible:ring-offset-0',
                          selectedSearchEntryId === entry.id
                            ? 'bg-control-selected text-content-primary hover:bg-control-selected'
                            : 'bg-transparent hover:bg-control-ghost-hover hover:text-content-primary',
                        )}
                        id={navigationItemId}
                        variant='ghost'
                        onClick={() => handleSearchResultSelect(entry, navigationItemId)}
                      >
                        <span className='block w-full truncate text-ui-control font-medium'>
                          {t(entry.titleI18nKey)}
                        </span>
                        {entry.descI18nKey ? (
                          <span className='mt-0.5 block w-full truncate text-ui-caption text-muted-foreground'>
                            {t(entry.descI18nKey)}
                          </span>
                        ) : null}
                        <span className='mt-0.5 block w-full truncate text-ui-caption text-muted-foreground'>
                          {path.join(' › ')}
                        </span>
                      </Button>
                    </li>
                  )
                })
              : settingDataGroupsKeys.map((groupKey) => {
                  const group = settingMap[groupKey] as Setting.SettingGroup
                  const index = settingDataGroupsKeys.indexOf(groupKey)
                  const navigationItemId = getNavigationItemId('setting-category', groupKey)
                  return (
                    <li key={groupKey}>
                      <Button
                        aria-current={index === value ? 'page' : undefined}
                        className={classNames(
                          'my-px h-7 w-full justify-start gap-2 rounded-md px-2 text-left text-ui-control font-normal text-foreground shadow-none focus-visible:ring-offset-0',
                          index === value
                            ? 'bg-control-selected font-medium text-content-primary hover:bg-control-selected'
                            : 'bg-transparent hover:bg-control-ghost-hover hover:text-content-primary',
                        )}
                        id={navigationItemId}
                        variant='ghost'
                        onClick={() => handleCategorySelect(groupKey, navigationItemId)}
                      >
                        <i aria-hidden className={classNames(group.iconName, 'text-sm')} />
                        <span className='min-w-0 truncate'>{t(group.i18nKey)}</span>
                      </Button>
                    </li>
                  )
                })}
            {normalizedSearchQuery && searchResults.length === 0 ? (
              <li className='px-2 py-6 text-center text-sm text-muted-foreground' role='status'>
                {t('settings.search_empty')}
              </li>
            ) : null}
          </ul>
        </nav>
        <footer className='shrink-0 border-t border-border/80 px-3 py-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <Logo aria-hidden='true' className='size-6 shrink-0' focusable='false' />
            <div aria-live='polite' className='min-w-0 flex-1'>
              <div className='flex min-w-0 items-baseline gap-1.5'>
                <span className='truncate text-ui-control font-medium text-foreground'>
                  {appInfo.name || t('app_name')}
                </span>
                {appInfo.version ? (
                  <span className='shrink-0 text-ui-caption tabular-nums text-muted-foreground'>
                    v{appInfo.version}
                  </span>
                ) : null}
              </div>
              {update ? (
                <p className='m-0 mt-0.5 truncate text-ui-caption text-muted-foreground'>
                  {t('about.newVersion')} · v{update.version}
                </p>
              ) : null}
            </div>
            {update ? (
              <Button
                className='shrink-0 px-2 text-primary shadow-none hover:text-primary'
                size='sm'
                variant='ghost'
                onClick={() => {
                  installUpdate(update)
                  setUpdate(null)
                }}
              >
                {t('about.install')}
              </Button>
            ) : null}
          </div>
        </footer>
      </aside>
      <main
        className={classNames(
          'box-border min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background',
          !mobileDetailOpen && 'max-[719px]:hidden',
        )}
      >
        <div className='box-border mx-auto w-full max-w-[58rem] px-8 pt-7 pb-12 max-lg:px-6 max-[719px]:px-4 max-[719px]:pt-3'>
          <Button
            className='mb-3 px-2 text-muted-foreground min-[720px]:hidden'
            size='sm'
            variant='ghost'
            onClick={closeMobileDetail}
          >
            <ArrowLeft aria-hidden className='size-4' />
            {t('settings.back_to_settings')}
          </Button>
          <header className='mb-5 flex items-start justify-between gap-4'>
            <div className='min-w-0'>
              <h1
                className='m-0 text-xl font-semibold text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                ref={categoryHeadingRef}
                tabIndex={-1}
              >
                {t(curGroup.i18nKey)}
              </h1>
              <p className='mt-1 mb-0 text-ui-body leading-relaxed text-muted-foreground'>
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
