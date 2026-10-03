import { clipboardRead } from '@/helper/clipboard'
import { EditorSelection, Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { requestImageInsert } from './requestImageInsert'
import { sourceCodeCodemirrorViewMap } from './sourceCodeEditorRegistry'

/** Keep asynchronous clipboard/image requests bound to their original document and selection. */
function selectionRestorer(view: EditorView, fileId?: string, isCurrent = () => true) {
  const { doc, selection } = view.state
  return () => {
    if (!isCurrent() || view.state.readOnly || view.state.doc !== doc) return false
    if (fileId && sourceCodeCodemirrorViewMap.get(fileId)?.cm !== view) return false
    view.focus()
    view.dispatch({ selection, annotations: Transaction.addToHistory.of(false) })
    return true
  }
}

export async function insertSourceLink(
  view: EditorView,
  fileId?: string,
  isCurrent?: () => boolean,
) {
  const restore = selectionRestorer(view, fileId, isCurrent)
  const { text } = await clipboardRead().catch(() => ({ text: '' }))
  if (!restore()) return false
  const url = /^(https?:\/\/|ftp:\/\/|mailto:|www\.)[^\s]+$/i.test(text) ? text : ''
  view.dispatch(
    view.state.changeByRange(({ from, to }) => {
      const title = view.state.sliceDoc(from, to)
      const offset = title ? (url ? 4 + title.length + url.length : 3 + title.length) : 1
      return {
        changes: { from, to, insert: `[${title}](${url})` },
        range: EditorSelection.cursor(from + offset),
      }
    }),
  )
  view.focus()
  return true
}

export async function insertSourceImage(
  view: EditorView,
  fileId?: string,
  isCurrent?: () => boolean,
) {
  const restore = selectionRestorer(view, fileId, isCurrent)
  const attributes = await requestImageInsert(fileId)
  if (!restore()) return false
  if (!attributes) {
    view.focus()
    return false
  }
  const { from, to } = view.state.selection.main
  const selectedText = view.state.sliceDoc(from, to)
  const alt = (selectedText || attributes.alt || '').replace(/([\\\]])/g, '\\$1')
  const src = /\s/.test(attributes.src)
    ? `<${attributes.src.replace(/>/g, '%3E')}>`
    : attributes.src.replace(/([()])/g, '\\$1')
  const title = attributes.title ? ` "${attributes.title.replace(/([\\"])/g, '\\$1')}"` : ''
  view.dispatch(view.state.replaceSelection(`![${alt}](${src}${title})`))
  view.focus()
  return true
}
