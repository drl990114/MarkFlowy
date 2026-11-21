export const EDITOR_WIDTH = { min: 480, default: 760, max: 1600 } as const
export const editorWidthModes = ['fixed', 'theme', 'full'] as const
export type EditorWidthMode = (typeof editorWidthModes)[number]

export function getEditorWidthMode(settings: Record<string, unknown>): EditorWidthMode {
  const mode = settings.editor_width_mode
  if (mode === 'fixed' || mode === 'theme' || mode === 'full') return mode
  if (typeof settings.editor_full_width === 'boolean') {
    return settings.editor_full_width ? 'full' : 'theme'
  }
  return 'fixed'
}

export function isValidEditorWidth(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= EDITOR_WIDTH.min &&
    value <= EDITOR_WIDTH.max
  )
}

export function getFixedEditorWidth(settings: Record<string, unknown>): number {
  const width = settings.editor_fixed_width
  return isValidEditorWidth(width) ? width : EDITOR_WIDTH.default
}

export function getEditorContentWidth(settings: Record<string, unknown>): string {
  switch (getEditorWidthMode(settings)) {
    case 'fixed':
      return `${getFixedEditorWidth(settings)}px`
    case 'theme':
      return `var(--mf-theme-editor-content-width, ${EDITOR_WIDTH.default}px)`
    case 'full':
      return '100%'
  }
}
