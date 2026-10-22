import { themeLabel } from '@/themes/runtime'
import { useThemeLibrary } from '@/themes/library'
import { Button } from '@/components/ui/button'
import { openUrl } from '@tauri-apps/plugin-opener'
import { logger } from '@/helper/logger'
import { ColorPicker } from '@/components/ui/color-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useThemeStore, { type ThemeMode } from '@/stores/useThemeStore'
import type { MfTheme } from '@markflowy/theme'
import { Check, ChevronRight, Moon, Sun } from 'lucide-react'
import { RadioGroupRoot, RadioGroupItem } from '@/components/ui/radio-group'
import { ThemePalette } from '../ThemeStore/ThemeListItem'
import { useThemeLabels } from '../ThemeStore/labels'
import {
  clearThemeAccentColorPreview,
  FOLLOW_THEME_ACCENT_COLOR,
  isThemeAccentColorOverride,
  normalizeThemeAccentColor,
  resolveThemeAccentColor,
  scheduleThemeAccentColorPreview,
  THEME_ACCENT_COLOR_SETTING_KEY,
} from '@/helper/theme'
import { memo, useCallback, useEffect, useId, useRef } from 'react'
import { useTranslation } from '@/i18n'
import styled, { useTheme } from 'styled-components'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import { SettingItemContainer } from '../component/SettingItems/Container'
import { SettingLabel } from '../component/SettingItems/Label'
import { getSettingGroupAnchorId } from '../settingSearch'

type AccentColorMode = 'system' | 'custom'

const AccentColorControls = styled.div`
  display: flex;
  align-items: stretch;

  [data-slot='select-trigger'] {
    border-bottom-right-radius: 0;
    border-top-right-radius: 0;
  }

  [data-slot='color-picker-trigger'] {
    border-bottom-left-radius: 0;
    border-left: 0;
    border-top-left-radius: 0;
  }
`

interface ThemeSettingProps {
  onBrowse: (mode?: MfTheme['mode']) => void
}

export const ThemeSetting = memo(({ onBrowse }: ThemeSettingProps) => {
  const { settingData } = useAppSettingStore()
  const libraryLoaded = useThemeLibrary((state) => state.loaded)
  const {
    themes,
    themeMode,
    lightThemeName,
    darkThemeName,
    setThemeMode,
    curTheme,
    commitAccentColor,
  } = useThemeStore()
  const { t } = useTranslation()
  const resolvedTheme = useTheme()

  const labels = useThemeLabels()
  const modeId = useId()
  const currentThemeMode = (settingData.theme_mode as ThemeMode) || themeMode
  const selectedLightTheme = String(settingData.light_theme || lightThemeName)
  const selectedDarkTheme = String(settingData.dark_theme || darkThemeName)
  const missingLightTheme =
    libraryLoaded &&
    !themes.some((theme) => theme.mode === 'light' && theme.name === selectedLightTheme)
  const missingDarkTheme =
    libraryLoaded &&
    !themes.some((theme) => theme.mode === 'dark' && theme.name === selectedDarkTheme)
  const unavailableThemes = [
    ...(missingLightTheme ? [selectedLightTheme] : []),
    ...(missingDarkTheme ? [selectedDarkTheme] : []),
  ]
  const accentColorSetting = settingData[THEME_ACCENT_COLOR_SETTING_KEY]
  const isCustomAccentColor = isThemeAccentColorOverride(accentColorSetting)
  const accentColorMode: AccentColorMode = isCustomAccentColor ? 'custom' : 'system'
  const accentColor = resolveThemeAccentColor(resolvedTheme.accentColor, accentColorSetting)
  const draftAccentColorRef = useRef(accentColor)
  const previewOwnerRef = useRef(Symbol('theme-accent-preview'))
  const previewGenerationRef = useRef(0)
  const previewActiveRef = useRef(false)
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const pendingPersistCountRef = useRef(0)
  const latestCommitRef = useRef<{ generation: number; value: string } | undefined>(undefined)
  const persistAccentColor = useCallback(
    (value: string, generation: number) => {
      const currentSetting = normalizeThemeAccentColor(
        useAppSettingStore.getState().settingData[THEME_ACCENT_COLOR_SETTING_KEY],
      )

      if (pendingPersistCountRef.current === 0 && currentSetting === value) {
        if (previewGenerationRef.current === generation) {
          previewActiveRef.current = false
          clearThemeAccentColorPreview(previewOwnerRef.current)
        }
        return
      }

      if (pendingPersistCountRef.current > 0 && latestCommitRef.current?.value === value) {
        latestCommitRef.current = { generation, value }
        return
      }

      latestCommitRef.current = { generation, value }
      pendingPersistCountRef.current += 1
      persistQueueRef.current = persistQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await commitAccentColor(value)
          } catch {
            // The store action logs and rolls back a failed config write.
          } finally {
            pendingPersistCountRef.current -= 1
            const latestCommit = latestCommitRef.current
            if (
              latestCommit?.value === value &&
              previewGenerationRef.current === latestCommit.generation
            ) {
              previewActiveRef.current = false
              clearThemeAccentColorPreview(previewOwnerRef.current)
            }
            if (latestCommit?.value === value) {
              latestCommitRef.current = undefined
            }
          }
        })
    },
    [commitAccentColor],
  )

  useEffect(() => {
    if (!previewActiveRef.current) draftAccentColorRef.current = accentColor
  }, [accentColor])

  useEffect(() => {
    return () => {
      if (previewActiveRef.current) {
        persistAccentColor(draftAccentColorRef.current, previewGenerationRef.current)
      }
    }
  }, [persistAccentColor])

  const handleAccentColorModeChange = (mode: AccentColorMode) => {
    const generation = previewGenerationRef.current + 1
    previewGenerationRef.current = generation
    const value = mode === 'custom' ? draftAccentColorRef.current : FOLLOW_THEME_ACCENT_COLOR

    if (mode === 'custom') {
      previewActiveRef.current = true
      scheduleThemeAccentColorPreview(value, previewOwnerRef.current)
    } else {
      previewActiveRef.current = false
      clearThemeAccentColorPreview(previewOwnerRef.current)
    }

    persistAccentColor(value, generation)
  }

  const handleAccentColorChange = (color: string) => {
    const nextColor = normalizeThemeAccentColor(color)
    if (nextColor === FOLLOW_THEME_ACCENT_COLOR) return

    draftAccentColorRef.current = nextColor
    previewGenerationRef.current += 1
    previewActiveRef.current = true
    scheduleThemeAccentColorPreview(nextColor, previewOwnerRef.current)
  }

  const handleAccentColorCommit = (color: string) => {
    const nextColor = normalizeThemeAccentColor(color)
    if (nextColor === FOLLOW_THEME_ACCENT_COLOR) return

    draftAccentColorRef.current = nextColor
    persistAccentColor(nextColor, previewGenerationRef.current)
  }

  return (
    <SettingGroupContainer $anchorId={getSettingGroupAnchorId('display', 'Theme')}>
      <h2 className='setting-group__title'>{t('settings.display.theme.label')}</h2>

      {unavailableThemes.length > 0 && (
        <div role='status' className='mb-2 text-sm text-muted-foreground'>
          <p className='m-0'>
            {t('settings.display.theme.unavailable_help', { names: unavailableThemes.join(', ') })}
          </p>
          <Button
            variant='link'
            size='sm'
            className='px-0'
            onClick={() => {
              const locale = String(settingData.language).startsWith('zh') ? '/zh' : ''
              void openUrl(`https://www.markflowy.cc${locale}/docs/Extension/CustomTheme`).catch(
                (error: unknown) => {
                  logger.error('Failed to open theme migration guide:', error)
                },
              )
            }}
          >
            {t('settings.display.theme.migration_guide')}
          </Button>
        </div>
      )}

      <div className='setting-group__items'>
        <SettingItemContainer $settingKey='theme_mode' className='flex-wrap'>
          <SettingLabel
            item={{
              key: 'theme_mode',
              title: { i18nKey: 'settings.display.theme.mode.label' },
              desc: { i18nKey: 'settings.display.theme.mode.desc' },
            }}
          />
          <RadioGroupRoot
            aria-label={t('settings.display.theme.mode.label')}
            orientation='horizontal'
            className='flex flex-wrap gap-x-4 gap-y-2'
            value={currentThemeMode}
            onValueChange={(value) => setThemeMode(value as ThemeMode)}
          >
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <label
                key={mode}
                htmlFor={`${modeId}-${mode}`}
                className='flex cursor-default select-none items-center gap-1.5'
              >
                <RadioGroupItem id={`${modeId}-${mode}`} value={mode} />
                {t(`settings.display.theme.mode.${mode}`)}
              </label>
            ))}
          </RadioGroupRoot>
        </SettingItemContainer>

        <div className='@container/theme-choice py-3'>
          <div className='grid gap-3 @min-[32rem]/theme-choice:grid-cols-2'>
            {(['light', 'dark'] as const).map((mode) => {
              const name = mode === 'light' ? selectedLightTheme : selectedDarkTheme
              const theme = themes.find((item) => item.mode === mode && item.name === name)
              const active = curTheme.mode === mode && curTheme.name === name
              const missing = mode === 'light' ? missingLightTheme : missingDarkTheme
              const ModeIcon = mode === 'light' ? Sun : Moon
              return (
                <section
                  key={mode}
                  aria-label={t(`settings.display.theme.${mode}_theme.label`)}
                  data-setting-key={`${mode}_theme`}
                  className='min-w-0 rounded-md border border-border bg-background p-3'
                >
                  <div className='mb-3 flex items-center gap-1.5 text-muted-foreground'>
                    <ModeIcon aria-hidden className='size-3.5' />
                    {t(`settings.display.theme.${mode}_theme.label`)}
                  </div>
                  <div className='flex flex-wrap items-center gap-3'>
                    {theme && <ThemePalette theme={theme} />}
                    <div className='min-w-0 flex-1 basis-24'>
                      <p className='m-0 break-words font-medium'>
                        {missing
                          ? t('settings.display.theme.unavailable', { name })
                          : theme
                            ? themeLabel(theme)
                            : name}
                      </p>
                      <p
                        className='m-0 mt-1 flex items-center gap-1 text-ui-caption text-muted-foreground'
                        aria-live='polite'
                      >
                        {active && <Check aria-hidden className='size-3 text-primary' />}
                        {active
                          ? labels.active
                          : labels[mode === 'light' ? 'useInLight' : 'useInDark']}
                      </p>
                    </div>
                  </div>
                  <div className='mt-3 flex justify-end'>
                    <Button
                      size='sm'
                      variant='outline'
                      aria-label={labels[mode === 'light' ? 'changeLight' : 'changeDark']}
                      onClick={() => onBrowse(mode)}
                    >
                      {labels.changeTheme}
                      <ChevronRight aria-hidden className='size-3.5' />
                    </Button>
                  </div>
                </section>
              )
            })}
          </div>
          <div className='mt-2 flex justify-end' data-setting-key='theme_library'>
            <Button size='sm' variant='ghost' onClick={() => onBrowse()}>
              {labels.browseThemes}
              <ChevronRight aria-hidden className='size-3.5' />
            </Button>
          </div>
        </div>

        <SettingItemContainer $settingKey={THEME_ACCENT_COLOR_SETTING_KEY}>
          <SettingLabel
            item={{
              key: THEME_ACCENT_COLOR_SETTING_KEY,
              title: { i18nKey: 'settings.display.theme.accent_color.label' },
              desc: { i18nKey: 'settings.display.theme.accent_color.desc' },
            }}
          />
          <AccentColorControls>
            <Select
              value={accentColorMode}
              onValueChange={(value) => handleAccentColorModeChange(value as AccentColorMode)}
            >
              <SelectTrigger
                size='sm'
                aria-label={t('settings.display.theme.accent_color.label')}
                style={{ width: 128 }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='system'>
                  {t('settings.display.theme.accent_color.follow_theme')}
                </SelectItem>
                <SelectItem value='custom'>
                  {t('settings.display.theme.accent_color.custom')}
                </SelectItem>
              </SelectContent>
            </Select>
            <ColorPicker
              aria-label={t('settings.display.theme.accent_color.label')}
              key={accentColorMode}
              value={accentColor}
              disabled={!isCustomAccentColor}
              onValueChange={handleAccentColorChange}
              onValueCommit={handleAccentColorCommit}
            />
          </AccentColorControls>
        </SettingItemContainer>
      </div>
    </SettingGroupContainer>
  )
})
