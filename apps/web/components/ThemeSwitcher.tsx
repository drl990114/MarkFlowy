import { useTranslation } from 'next-i18next'
import { useTheme, type WebThemePreference } from '../hooks/useTheme'
import PreferenceMenu from './PreferenceMenu'

const icons: Record<WebThemePreference, string> = {
  system: 'ri-computer-line',
  light: 'ri-sun-line',
  dark: 'ri-moon-line',
}
const preferences: WebThemePreference[] = ['system', 'light', 'dark']

export default function ThemeSwitcher() {
  const { t } = useTranslation()
  const { theme, setTheme, mounted } = useTheme()

  return (
    <PreferenceMenu
      label={t('navigation.theme')}
      icon={<i className={icons[theme]} />}
      value={theme}
      disabled={!mounted}
      onValueChange={setTheme}
      options={preferences.map((preference) => ({
        value: preference,
        label: t(`theme.${preference}`),
        icon: <i className={icons[preference]} />,
      }))}
    />
  )
}
