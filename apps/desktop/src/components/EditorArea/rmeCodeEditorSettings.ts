import type { EditorContext, MfCodemirrorView } from 'rme'
import type { CodeEditorSettings } from './codeEditorSettings'

/** Optional only at the installed-package boundary, until RME is rebuilt. */
interface SettingsRuntime {
  updateCodemirrorSettings?: (owner: EditorContext['view'], options: CodeEditorSettings) => void
}

export function updateSourceCodeSettings(view: MfCodemirrorView, options: CodeEditorSettings) {
  const configurable: MfCodemirrorView & {
    updateSettings?: (settings: CodeEditorSettings) => void
  } = view
  configurable.updateSettings?.(options)
}

export function updateEmbeddedCodeSettings(
  runtime: object,
  context: EditorContext,
  options: CodeEditorSettings,
) {
  const configurable: SettingsRuntime = runtime
  configurable.updateCodemirrorSettings?.(context.view, options)
}
