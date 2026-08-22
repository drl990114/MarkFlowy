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
import type { ThemePreviewSelection } from '@/stores/useThemeStore'
import {
  clearThemeAccentColorPreview,
  FOLLOW_THEME_ACCENT_COLOR,
  isThemeAccentColorOverride,
  normalizeThemeAccentColor,
  resolveThemeAccentColor,
  scheduleThemeAccentColorPreview,
  THEME_ACCENT_COLOR_SETTING_KEY,
} from '@/helper/theme'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from '@/i18n'
import styled, { useTheme } from 'styled-components'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import { SettingItemContainer } from '../component/SettingItems/Container'
import { SettingLabel } from '../component/SettingItems/Label'
import { getSettingGroupAnchorId } from '../settingSearch'

type AccentColorMode = 'system' | 'custom'
type ThemePreviewKind = 'mode' | 'light' | 'dark'

const SELECT_WIDTH = 200

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
  revealedSettingKey?: string
}

export const ThemeSetting = memo(({ revealedSettingKey }: ThemeSettingProps) => {
  const { settingData } = useAppSettingStore()
  const {
    themes,
    themeMode,
    lightThemeName,
    darkThemeName,
    setThemeMode,
    setLightTheme,
    setDarkTheme,
    previewTheme,
    restoreThemePreview,
    commitAccentColor,
  } = useThemeStore()
  const { t } = useTranslation()
  const resolvedTheme = useTheme()

  const lightThemes = useMemo(
    () => themes.filter((themeItem) => themeItem.mode === 'light'),
    [themes],
  )
  const darkThemes = useMemo(
    () => themes.filter((themeItem) => themeItem.mode === 'dark'),
    [themes],
  )

  const currentThemeMode = (settingData.theme_mode as ThemeMode) || themeMode
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
  const themePreviewGenerationRef = useRef(0)
  const themePreviewSessionRef = useRef<{
    committed: boolean
    generation: number
    kind: ThemePreviewKind
  } | undefined>(undefined)

  const handleThemePreviewOpenChange = useCallback(
    (kind: ThemePreviewKind, open: boolean) => {
      if (open) {
        themePreviewGenerationRef.current += 1
        themePreviewSessionRef.current = {
          committed: false,
          generation: themePreviewGenerationRef.current,
          kind,
        }
        return
      }

      const session = themePreviewSessionRef.current
      if (!session || session.kind !== kind) return

      queueMicrotask(() => {
        const currentSession = themePreviewSessionRef.current
        if (!currentSession || currentSession.generation !== session.generation) return
        if (!currentSession.committed) restoreThemePreview()
        themePreviewSessionRef.current = undefined
      })
    },
    [restoreThemePreview],
  )

  const previewThemeSelection = useCallback(
    (kind: ThemePreviewKind, selection: ThemePreviewSelection) => {
      if (themePreviewSessionRef.current?.kind === kind) previewTheme(selection)
    },
    [previewTheme],
  )

  const commitThemeSelection = useCallback((kind: ThemePreviewKind, commit: () => void) => {
    const session = themePreviewSessionRef.current
    if (session?.kind === kind) session.committed = true
    commit()
  }, [])

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

      if (
        pendingPersistCountRef.current > 0 &&
        latestCommitRef.current?.value === value
      ) {
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
        persistAccentColor(
          draftAccentColorRef.current,
          previewGenerationRef.current,
        )
      }
      if (themePreviewSessionRef.current && !themePreviewSessionRef.current.committed) {
        restoreThemePreview()
      }
      themePreviewSessionRef.current = undefined
    }
  }, [persistAccentColor, restoreThemePreview])

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
      <div className='setting-group__title'>{t('settings.display.theme.label')}</div>

      <SettingItemContainer $settingKey='theme_mode'>
        <SettingLabel
          item={{
            key: 'theme_mode',
            title: { i18nKey: 'settings.display.theme.mode.label' },
            desc: { i18nKey: 'settings.display.theme.mode.desc' },
          }}
        />
        <Select
          onOpenChange={(open) => handleThemePreviewOpenChange('mode', open)}
          value={currentThemeMode}
          onValueChange={(value) => {
            commitThemeSelection('mode', () => setThemeMode(value as ThemeMode))
          }}
        >
          <SelectTrigger
            aria-label={t('settings.display.theme.mode.label')}
            style={{ width: SELECT_WIDTH }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              onFocus={() => previewThemeSelection('mode', { themeMode: 'system' })}
              value='system'
            >
              {t('settings.display.theme.mode.system')}
            </SelectItem>
            <SelectItem
              onFocus={() => previewThemeSelection('mode', { themeMode: 'light' })}
              value='light'
            >
              {t('settings.display.theme.mode.light')}
            </SelectItem>
            <SelectItem
              onFocus={() => previewThemeSelection('mode', { themeMode: 'dark' })}
              value='dark'
            >
              {t('settings.display.theme.mode.dark')}
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingItemContainer>

      {(currentThemeMode === 'light' ||
        currentThemeMode === 'system' ||
        revealedSettingKey === 'light_theme') && (
        <SettingItemContainer $settingKey='light_theme'>
          <SettingLabel
            item={{
              key: 'light_theme',
              title: { i18nKey: 'settings.display.theme.light_theme.label' },
              desc: { i18nKey: 'settings.display.theme.light_theme.desc' },
            }}
          />
          <Select
            onOpenChange={(open) => handleThemePreviewOpenChange('light', open)}
            value={String(settingData.light_theme || lightThemeName)}
            onValueChange={(value) => {
              commitThemeSelection('light', () => setLightTheme(value))
            }}
          >
            <SelectTrigger
              aria-label={t('settings.display.theme.light_theme.label')}
              style={{ width: SELECT_WIDTH }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lightThemes.map((themeItem) => (
                <SelectItem
                  key={themeItem.name}
                  onFocus={() =>
                    previewThemeSelection('light', {
                      lightThemeName: themeItem.name,
                      themeMode: 'light',
                    })
                  }
                  value={themeItem.name}
                >
                  {themeItem.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingItemContainer>
      )}

      {(currentThemeMode === 'dark' ||
        currentThemeMode === 'system' ||
        revealedSettingKey === 'dark_theme') && (
        <SettingItemContainer $settingKey='dark_theme'>
          <SettingLabel
            item={{
              key: 'dark_theme',
              title: { i18nKey: 'settings.display.theme.dark_theme.label' },
              desc: { i18nKey: 'settings.display.theme.dark_theme.desc' },
            }}
          />
          <Select
            onOpenChange={(open) => handleThemePreviewOpenChange('dark', open)}
            value={String(settingData.dark_theme || darkThemeName)}
            onValueChange={(value) => {
              commitThemeSelection('dark', () => setDarkTheme(value))
            }}
          >
            <SelectTrigger
              aria-label={t('settings.display.theme.dark_theme.label')}
              style={{ width: SELECT_WIDTH }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {darkThemes.map((themeItem) => (
                <SelectItem
                  key={themeItem.name}
                  onFocus={() =>
                    previewThemeSelection('dark', {
                      darkThemeName: themeItem.name,
                      themeMode: 'dark',
                    })
                  }
                  value={themeItem.name}
                >
                  {themeItem.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingItemContainer>
      )}

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
    </SettingGroupContainer>
  )
})
