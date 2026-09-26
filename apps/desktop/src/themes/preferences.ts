import type { ThemeOverrides } from '@markflowy/theme/semantic'
import { normalizeFontFamily } from '@/appThemeTokens'

interface TypographyPreferences {
  theme_use_personal_typography?: boolean
  editor_root_font_family?: string
  editor_code_font_family?: string
  editor_root_font_size?: number
  editor_root_line_height?: string
}

export function typographyOverrides(settings: TypographyPreferences): ThemeOverrides {
  if (settings.theme_use_personal_typography === false) return {}
  const rootFamily = settings.editor_root_font_family
  const codeFamily = settings.editor_code_font_family
  return {
    ...(rootFamily && rootFamily !== 'System Default'
      ? { 'font.editor.family': normalizeFontFamily(rootFamily) }
      : {}),
    ...(codeFamily && codeFamily !== 'Default Monospace'
      ? { 'font.code.family': normalizeFontFamily(codeFamily) }
      : {}),
    ...(settings.editor_root_font_size
      ? { 'font.editor.size': `${settings.editor_root_font_size}px` }
      : {}),
    ...(settings.editor_root_line_height
      ? { 'font.editor.lineHeight': String(settings.editor_root_line_height) }
      : {}),
  }
}
