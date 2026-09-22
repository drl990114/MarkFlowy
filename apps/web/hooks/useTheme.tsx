import { useTheme as useNextTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import type { WebThemeMode } from '../utils/websiteTheme'

export type WebThemePreference = WebThemeMode | 'system'

export function useTheme() {
  const { theme, resolvedTheme, setTheme } = useNextTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // SSR cannot read localStorage. Keep controls and editor mode consistent with
  // the server until hydration; CSS already uses the pre-paint resolved palette.
  const preference: WebThemePreference =
    mounted && (theme === 'light' || theme === 'dark') ? theme : 'system'
  const mode: WebThemeMode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light'

  return { theme: preference, resolvedTheme: mode, setTheme, mounted }
}
