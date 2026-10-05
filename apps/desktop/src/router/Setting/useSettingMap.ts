import { useTranslation } from '@/i18n'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { SemanticThemeContext } from '@/themes/context'
import { useContext, useMemo } from 'react'
import { getSettingMap } from './settingMap'

export function useSettingMap() {
  const { t } = useTranslation()
  const theme = useContext(SemanticThemeContext)
  const rootFontSize = useAppSettingStore((state) => state.settingData.editor_root_font_size)
  const legacyWrapping = useAppSettingStore(
    (state) => state.settingData.wysiwyg_editor_codemirror_line_wrap,
  )
  const personalTypography = useAppSettingStore(
    (state) => state.settingData.theme_use_personal_typography !== false,
  )
  // Match TextEditor's resolved theme, including the personal typography switch.
  const bodyFontSize = theme?.['font.editor.size'] ?? `${rootFontSize ?? 16}px`

  // Option labels are translated when the map is created, so language changes
  // must refresh them along with inherited editor preferences.
  return useMemo(() => getSettingMap({
    bodyFontSize,
    codeBlockLineWrapping: legacyWrapping !== false,
    personalTypography,
  }, t), [bodyFontSize, legacyWrapping, personalTypography, t])
}
