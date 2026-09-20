import type { desktopLightTheme, MfTheme } from '@markflowy/theme'
import { createContext } from 'react'

export interface EditorThemeConfig {
  mode: MfTheme['mode']
  name: string
  token: typeof desktopLightTheme
  codemirrorTheme: MfTheme['codemirrorTheme']
  language?: string
}

/** Lightweight app-owned values; the editor boundary loads the RME theme implementation. */
export const EditorThemeContext = createContext<EditorThemeConfig | null>(null)
