import useAppSettingStore from '@/stores/useAppSettingStore'
import useThemeStore, { type ThemeMode } from '@/stores/useThemeStore'
import { Select } from 'antd'
import { memo, useMemo } from 'react'
import { useTranslation } from '@/i18n'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import { SettingItemContainer } from '../component/SettingItems/Container'
import { SettingLabel } from '../component/SettingItems/Label'

export const ThemeSetting = memo(() => {
  const { settingData } = useAppSettingStore()
  const { themes, themeMode, lightThemeName, darkThemeName, setThemeMode, setLightTheme, setDarkTheme } = useThemeStore()
  const { t } = useTranslation()

  const lightThemes = useMemo(() => themes.filter((t) => t.mode === 'light'), [themes])
  const darkThemes = useMemo(() => themes.filter((t) => t.mode === 'dark'), [themes])

  const currentThemeMode = (settingData.theme_mode as ThemeMode) || themeMode

  return (
    <SettingGroupContainer>
      <div className='setting-group__title'>{t('settings.display.theme.label')}</div>

      <SettingItemContainer>
        <SettingLabel
          item={{
            key: 'theme_mode',
            type: 'select',
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
              type: 'select',
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
              type: 'select',
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
    </SettingGroupContainer>
  )
})
