import useAppSettingStore from '@/stores/useAppSettingStore'
import useThemeStore, { type ThemeMode } from '@/stores/useThemeStore'
import appSettingService from '@/services/app-setting'
import {
  FOLLOW_THEME_ACCENT_COLOR,
  isThemeAccentColorOverride,
  normalizeThemeAccentColor,
  resolveThemeAccentColor,
  THEME_ACCENT_COLOR_SETTING_KEY,
} from '@/helper/theme'
import { ColorPicker, Select, Space } from 'antd'
import { debounce } from 'lodash'
import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/i18n'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import { SettingItemContainer } from '../component/SettingItems/Container'
import { SettingLabel } from '../component/SettingItems/Label'

type AccentColorMode = 'system' | 'custom'

export const ThemeSetting = memo(() => {
  const { settingData } = useAppSettingStore()
  const {
    themes,
    themeMode,
    lightThemeName,
    darkThemeName,
    curTheme,
    setThemeMode,
    setLightTheme,
    setDarkTheme,
  } = useThemeStore()
  const { t } = useTranslation()

  const lightThemes = useMemo(() => themes.filter((t) => t.mode === 'light'), [themes])
  const darkThemes = useMemo(() => themes.filter((t) => t.mode === 'dark'), [themes])

  const currentThemeMode = (settingData.theme_mode as ThemeMode) || themeMode
  const accentColorSetting = settingData[THEME_ACCENT_COLOR_SETTING_KEY]
  const isCustomAccentColor = isThemeAccentColorOverride(accentColorSetting)
  const accentColorMode: AccentColorMode = isCustomAccentColor ? 'custom' : 'system'
  const accentColor = resolveThemeAccentColor(curTheme.styledConstants.accentColor, accentColorSetting)
  const [draftAccentColor, setDraftAccentColor] = useState(accentColor)

  const writeAccentColor = useMemo(
    () =>
      debounce((value: string) => {
        appSettingService.writeSettingData({ key: THEME_ACCENT_COLOR_SETTING_KEY }, value)
      }, 220),
    [],
  )

  useEffect(() => {
    setDraftAccentColor(accentColor)
  }, [accentColor])

  useEffect(() => {
    return () => {
      writeAccentColor.flush()
    }
  }, [writeAccentColor])

  const handleAccentColorModeChange = (mode: AccentColorMode) => {
    writeAccentColor.cancel()
    const value = mode === 'custom' ? draftAccentColor : FOLLOW_THEME_ACCENT_COLOR
    appSettingService.writeSettingData({ key: THEME_ACCENT_COLOR_SETTING_KEY }, value)
  }

  const handleAccentColorChange = (color: { toHexString: () => string }) => {
    const nextColor = normalizeThemeAccentColor(color.toHexString())
    setDraftAccentColor(nextColor)
    writeAccentColor(nextColor)
  }

  return (
    <SettingGroupContainer>
      <div className='setting-group__title'>{t('settings.display.theme.label')}</div>

      <SettingItemContainer>
        <SettingLabel
          item={{
            key: 'theme_mode',
            title: { i18nKey: 'settings.display.theme.mode.label' },
            desc: { i18nKey: 'settings.display.theme.mode.desc' },
          }}
        />
        <Select
          value={currentThemeMode}
          options={[
            { value: 'system', label: t('settings.display.theme.mode.system') },
            { value: 'light', label: t('settings.display.theme.mode.light') },
            { value: 'dark', label: t('settings.display.theme.mode.dark') },
          ]}
          onChange={(value) => {
            setThemeMode(value)
          }}
          style={{ width: 220 }}
        />
      </SettingItemContainer>

      {(currentThemeMode === 'light' || currentThemeMode === 'system') && (
        <SettingItemContainer>
          <SettingLabel
            item={{
              key: 'light_theme',
              title: { i18nKey: 'settings.display.theme.light_theme.label' },
              desc: { i18nKey: 'settings.display.theme.light_theme.desc' },
            }}
          />
          <Select
            value={settingData.light_theme || lightThemeName}
            options={lightThemes.map((t) => ({ value: t.name, label: t.name }))}
            onChange={(value) => {
              setLightTheme(value)
            }}
            style={{ width: 220 }}
          />
        </SettingItemContainer>
      )}

      {(currentThemeMode === 'dark' || currentThemeMode === 'system') && (
        <SettingItemContainer>
          <SettingLabel
            item={{
              key: 'dark_theme',
              title: { i18nKey: 'settings.display.theme.dark_theme.label' },
              desc: { i18nKey: 'settings.display.theme.dark_theme.desc' },
            }}
          />
          <Select
            value={settingData.dark_theme || darkThemeName}
            options={darkThemes.map((t) => ({ value: t.name, label: t.name }))}
            onChange={(value) => {
              setDarkTheme(value)
            }}
            style={{ width: 220 }}
          />
        </SettingItemContainer>
      )}

      <SettingItemContainer>
        <SettingLabel
          item={{
            key: THEME_ACCENT_COLOR_SETTING_KEY,
            title: { i18nKey: 'settings.display.theme.accent_color.label' },
            desc: { i18nKey: 'settings.display.theme.accent_color.desc' },
          }}
        />
        <Space.Compact>
          <Select
            value={accentColorMode}
            options={[
              { value: 'system', label: t('settings.display.theme.accent_color.follow_theme') },
              { value: 'custom', label: t('settings.display.theme.accent_color.custom') },
            ]}
            onChange={handleAccentColorModeChange}
            style={{ width: 140 }}
          />
          <ColorPicker
            value={draftAccentColor}
            format='hex'
            disabled={!isCustomAccentColor}
            disabledAlpha
            onChange={handleAccentColorChange}
            onOpenChange={(open) => {
              if (!open) {
                writeAccentColor.flush()
              }
            }}
          />
        </Space.Compact>
      </SettingItemContainer>
    </SettingGroupContainer>
  )
})
