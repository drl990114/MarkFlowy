const ACTIVE_EDITOR_SELECTOR = '[data-editor-active="true"]'
const EDITOR_PANEL_BLANK_TARGET_SELECTOR = [
  '.code-contents',
  '.os-viewport',
  '[data-overlayscrollbars-contents]',
  '[data-overlayscrollbars-viewport]',
].join(', ')
const EDITOR_FOCUS_TARGET_SELECTOR = [
  '[contenteditable="true"]',
  'textarea:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function isEditorPanelBlankTarget(
  target: EventTarget | null,
  editorPanel: HTMLElement,
): boolean {
  if (!(target instanceof HTMLElement) || !editorPanel.contains(target)) return false

  return target === editorPanel || target.matches(EDITOR_PANEL_BLANK_TARGET_SELECTOR)
}

export function focusActiveEditor(): boolean {
  const activeEditor = document.querySelector<HTMLElement>(ACTIVE_EDITOR_SELECTOR)
  if (!activeEditor) return false

  const activeElement = document.activeElement
  if (activeElement && activeEditor.contains(activeElement)) return true

  const focusTarget =
    activeEditor.querySelector<HTMLElement>(EDITOR_FOCUS_TARGET_SELECTOR) ?? activeEditor

  focusTarget.focus({ preventScroll: true })
  return document.activeElement === focusTarget
}

export function scheduleActiveEditorFocus(): void {
  window.requestAnimationFrame(() => {
    focusActiveEditor()
  })
}
