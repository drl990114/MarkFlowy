import type { Node } from '@rme-sdk/pm/model'
import { useMemo } from 'react'
import type { EditorDelegate } from '../types'

type InitialContentDelegate = Pick<EditorDelegate, 'stringToDoc'>

export type InitialEditorContentResult = { ok: true; doc: Node } | { ok: false; error: unknown }

/**
 * Parse the initial document only when the editor delegate changes.
 *
 * Remirror consumes `initialContent` only while creating its framework state.
 * Later `content` updates are applied through `EditorRef.setContent`, so parsing
 * them here would do duplicate whole-document work on every edit.
 */
export function useInitialEditorContent(
  delegate: InitialContentDelegate,
  content: string,
): InitialEditorContentResult {
  return useMemo(() => {
    try {
      return { ok: true, doc: delegate.stringToDoc(content) }
    } catch (error) {
      return { ok: false, error }
    }
    // `content` is intentionally initial-only; live updates use EditorRef.setContent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegate])
}
