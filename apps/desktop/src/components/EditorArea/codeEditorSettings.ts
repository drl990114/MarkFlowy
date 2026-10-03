/** Serializable options shared by the host adapters; never import a CM runtime here. */
export interface CodeEditorSettings {
  lineWrapping?: boolean
  lineNumbers?: 'off' | 'all' | 'sparse'
  indentStyle?: 'spaces' | 'tabs'
  indentSize?: 2 | 4 | 8
  autoCloseBrackets?: boolean
  highlightActiveLine?: boolean
  whitespace?: 'off' | 'trailing' | 'all'
}

const preferenceKeys = [
  'editor_code_indent_style',
  'editor_code_indent_size',
  'editor_code_auto_close_brackets',
  'editor_code_whitespace',
  'source_code_editor_line_wrap',
  'source_code_editor_line_numbers',
  'source_code_editor_highlight_active_line',
  'embedded_code_editor_line_wrap',
  'embedded_code_editor_line_numbers',
  'embedded_code_editor_highlight_active_line',
  'wysiwyg_editor_codemirror_line_wrap',
  'editor_code_font_size',
  'editor_code_line_height',
  'theme_use_personal_typography',
] as const

export function selectCodeEditorPreferences(settings: Record<string, unknown>) {
  return Object.fromEntries(preferenceKeys.map((key) => [key, settings[key]]))
}

function booleanOverride(value: unknown): boolean | undefined {
  return value === 'on' ? true : value === 'off' ? false : undefined
}

function displaySettings(settings: Record<string, unknown>, prefix: string): CodeEditorSettings {
  const lineNumbers = settings[`${prefix}_line_numbers`]
  return {
    lineWrapping: booleanOverride(settings[`${prefix}_line_wrap`]),
    lineNumbers:
      lineNumbers === 'off' || lineNumbers === 'all' || lineNumbers === 'sparse'
        ? lineNumbers
        : undefined,
    highlightActiveLine: booleanOverride(settings[`${prefix}_highlight_active_line`]),
  }
}

export function resolveCodeEditorPreferences(settings: Record<string, unknown>) {
  const indentSize = settings.editor_code_indent_size
  const indentStyle = settings.editor_code_indent_style
  const whitespace = settings.editor_code_whitespace
  const common: CodeEditorSettings = {
    indentStyle: indentStyle === 'spaces' || indentStyle === 'tabs' ? indentStyle : undefined,
    indentSize:
      indentSize === '2' || indentSize === '4' || indentSize === '8'
        ? (Number(indentSize) as 2 | 4 | 8)
        : undefined,
    autoCloseBrackets:
      typeof settings.editor_code_auto_close_brackets === 'boolean'
        ? settings.editor_code_auto_close_brackets
        : undefined,
    whitespace:
      whitespace === 'off' || whitespace === 'trailing' || whitespace === 'all'
        ? whitespace
        : undefined,
  }
  const source = { ...common, ...displaySettings(settings, 'source_code_editor') }
  const embedded = { ...common, ...displaySettings(settings, 'embedded_code_editor') }
  const legacyLineWrapping =
    typeof settings.wysiwyg_editor_codemirror_line_wrap === 'boolean'
      ? settings.wysiwyg_editor_codemirror_line_wrap
      : undefined
  const fontSize = settings.editor_code_font_size
  const lineHeight =
    typeof settings.editor_code_line_height === 'string' && settings.editor_code_line_height.trim()
      ? Number(settings.editor_code_line_height)
      : undefined
  const personalTypography = settings.theme_use_personal_typography !== false

  return {
    source,
    embedded,
    // Capricorn retains its old wrapping scope through the separate legacy field.
    rmeEmbedded: { ...embedded, lineWrapping: embedded.lineWrapping ?? legacyLineWrapping },
    legacyLineWrapping,
    fontSize:
      personalTypography &&
      typeof fontSize === 'number' &&
      Number.isInteger(fontSize) &&
      fontSize >= 12 &&
      fontSize <= 40
        ? `${fontSize}px`
        : undefined,
    lineHeight:
      personalTypography &&
      lineHeight !== undefined &&
      Number.isFinite(lineHeight) &&
      lineHeight >= 1 &&
      lineHeight <= 2
        ? String(Math.round(lineHeight * 10) / 10)
        : undefined,
  }
}
