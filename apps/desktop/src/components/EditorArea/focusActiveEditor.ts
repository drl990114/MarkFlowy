import { EditorViewType } from '@/constants/editorViewType'
import { getCapricornEditor } from './capricornEditorRegistry'
import { sourceCodeCodemirrorViewMap } from './sourceCodeEditorInstances'

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

export interface EditorFocusSnapshot {
  restore: () => boolean
  release: () => void
}

function getActiveEditor() {
  const element = document.querySelector<HTMLElement>(ACTIVE_EDITOR_SELECTOR)
  const fileId = element?.dataset.editorId
  const mode = element?.querySelector<HTMLElement>('[data-mf-editor-mode]')?.dataset.mfEditorMode
  return {
    element,
    rich: fileId && mode === EditorViewType.WYSIWYG ? getCapricornEditor(fileId) : undefined,
    source:
      fileId && mode === EditorViewType.SOURCECODE
        ? sourceCodeCodemirrorViewMap.get(fileId)?.cm
        : undefined,
    mode,
  }
}

/** Capture before an overlay makes the workspace inert or takes its selection. */
export function captureActiveEditorFocus(): EditorFocusSnapshot | null {
  const { element, rich, source, mode } = getActiveEditor()
  if (!element) return null
  const embeddedCode = rich?.captureEmbeddedCodeFocus?.()
  const bookmark = rich?.selection?.capture()
  const sourceState = source?.state
  const focused = document.activeElement
  const input =
    element.contains(focused) &&
    (focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement)
      ? focused
      : null
  const inputSelection = input
    ? ([input.selectionStart, input.selectionEnd, input.selectionDirection] as const)
    : null

  return {
    restore: () => {
      const current = getActiveEditor()
      if (current.element !== element || current.mode !== mode) return false
      if (rich) {
        if (current.rich !== rich) return false
        if (embeddedCode?.restore()) return true
        if (bookmark) rich.selection?.restore(bookmark.id)
        rich.focus()
        return true
      }
      if (source) {
        if (current.source !== source) return false
        source.focus()
        if (sourceState && source.state.doc === sourceState.doc) {
          source.dispatch({
            selection: sourceState.selection,
          })
        }
        return true
      }
      if (input?.isConnected && inputSelection) {
        input.focus({ preventScroll: true })
        const [start, end, direction] = inputSelection
        if (start !== null && end !== null)
          input.setSelectionRange(start, end, direction ?? undefined)
        return document.activeElement === input
      }
      return focusActiveEditor()
    },
    release: () => {
      if (bookmark) rich?.selection?.release(bookmark.id)
    },
  }
}

export function isEditorPanelBlankTarget(
  target: EventTarget | null,
  editorPanel: HTMLElement,
): boolean {
  if (!(target instanceof HTMLElement) || !editorPanel.contains(target)) return false

  return target === editorPanel || target.matches(EDITOR_PANEL_BLANK_TARGET_SELECTOR)
}

export function focusActiveEditor(): boolean {
  const { element: activeEditor, rich, source, mode } = getActiveEditor()
  if (!activeEditor) return false

  // Capricorn portals its keyboard input to document.body. DOM containment
  // cannot locate it; the runtime also owns restoring its logical caret.
  if (rich) {
    rich.focus()
    return true
  }
  if (source) {
    source.focus()
    return true
  }

  const activeElement = document.activeElement
  if (activeElement && activeEditor.contains(activeElement)) return true

  const focusTarget =
    (mode !== EditorViewType.PREVIEW &&
      activeEditor.querySelector<HTMLElement>(EDITOR_FOCUS_TARGET_SELECTOR)) ||
    activeEditor

  focusTarget.focus({ preventScroll: true })
  return document.activeElement === focusTarget
}

export function scheduleActiveEditorFocus(snapshot?: EditorFocusSnapshot | null): () => void {
  let pending = true
  const frame = window.requestAnimationFrame(() => {
    try {
      if (!snapshot?.restore()) focusActiveEditor()
    } finally {
      pending = false
      snapshot?.release()
    }
  })
  return () => {
    window.cancelAnimationFrame(frame)
    if (pending) snapshot?.release()
    pending = false
  }
}
