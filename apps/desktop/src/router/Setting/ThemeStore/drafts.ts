import { parseThemeDocument, type ThemeDocument } from '@markflowy/theme/semantic'

const DRAFT_PREFIX = 'mf-theme-editor-draft-v2:'
export interface ThemeEditorSession {
  version: 1
  document: ThemeDocument
  variantId: string
  /** Unapplied JSON is draft data, including temporarily invalid JSON. */
  json?: string
}
export interface ThemeDraft {
  key: string
  session: ThemeEditorSession
}
export const themeDraftKey = (documentId: string) => `${DRAFT_PREFIX}${documentId}`
export function readThemeDrafts(): ThemeDraft[] {
  const drafts: ThemeDraft[] = []
  let keys: (string | null)[]
  try {
    keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
  } catch {
    return drafts
  }
  for (const key of keys) {
    if (!key?.startsWith(DRAFT_PREFIX)) continue
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? '')
      if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
        continue
      const draft = value as Record<string, unknown>
      const document = parseThemeDocument(draft.document)
      const variantId = document.variants.some((item) => item.id === draft.variantId)
        ? String(draft.variantId)
        : document.variants[0].id
      drafts.push({
        key,
        session: {
          version: 1,
          document,
          variantId,
          ...(typeof draft.json === 'string' ? { json: draft.json } : {}),
        },
      })
    } catch {
      // An unreadable draft must not prevent the other drafts from being recovered.
    }
  }
  return drafts
}
export function writeThemeDraft(key: string, session: ThemeEditorSession) {
  sessionStorage.setItem(key, JSON.stringify(session))
}
