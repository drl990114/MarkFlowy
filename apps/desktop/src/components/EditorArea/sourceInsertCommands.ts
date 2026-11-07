import { clipboardRead } from '@/helper/clipboard'
import { EditorSelection, Transaction } from '@codemirror/state'
import { isolateHistory } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { requestImageInsert } from './requestImageInsert'
import { getSourceCodeEditor } from './sourceCodeEditorRegistry'

export type InsertBlockKind = 'code' | 'math'

/** Insert one Markdown block and retain the selected content in a single undo step. */
export function insertSourceBlock(view: EditorView, kind: InsertBlockKind): boolean {
  if (view.state.readOnly) return false
  const { from, to } = view.state.selection.main
  const content = view.state.sliceDoc(from, to)
  const before = view.state.sliceDoc(Math.max(0, from - 2), from)
  const after = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + 2))
  const prefix = before ? '\n'.repeat(Math.max(0, 2 - (before.match(/\n*$/)?.[0].length ?? 0))) : ''
  const suffix = after ? '\n'.repeat(Math.max(0, 2 - (after.match(/^\n*/)?.[0].length ?? 0))) : '\n'
  // A longer fence keeps selected Markdown examples inside the new code block.
  let fenceLength = 3
  if (kind === 'code') {
    for (const match of content.matchAll(/`+/g)) fenceLength = Math.max(fenceLength, match[0].length + 1)
  }
  const fence = kind === 'math' ? '$$' : '`'.repeat(fenceLength)
  const start = from + prefix.length + fence.length + 1
  view.dispatch({
    changes: { from, to, insert: `${prefix}${fence}\n${content}${content.endsWith('\n') ? '' : '\n'}${fence}${suffix}` },
    selection: EditorSelection.range(start, start + content.length),
    userEvent: 'input',
    annotations: isolateHistory.of('full'),
    scrollIntoView: true,
  })
  view.focus()
  return true
}

/** Keep asynchronous clipboard/image requests bound to their original document and selection. */
function selectionRestorer(
  view: EditorView,
  fileId?: string,
  isCurrent = () => true,
  groupId?: string,
) {
  const { doc, selection } = view.state
  return () => {
    if (!isCurrent() || view.state.readOnly || view.state.doc !== doc) return false
    if (fileId && getSourceCodeEditor(fileId, groupId)?.cm !== view) return false
    view.focus()
    view.dispatch({ selection, annotations: Transaction.addToHistory.of(false) })
    return true
  }
}

export async function insertSourceLink(
  view: EditorView,
  fileId?: string,
  isCurrent?: () => boolean,
  groupId?: string,
) {
  const restore = selectionRestorer(view, fileId, isCurrent, groupId)
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
  groupId?: string,
) {
  const restore = selectionRestorer(view, fileId, isCurrent, groupId)
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
