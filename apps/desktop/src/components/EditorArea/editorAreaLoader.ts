import type * as EditorAreaModule from './EditorAreaContent'

let pending: Promise<typeof EditorAreaModule> | undefined

export function loadEditorAreaContent() {
  pending ??= import('./EditorAreaContent').catch((error: unknown) => {
    pending = undefined
    throw error
  })
  return pending
}
