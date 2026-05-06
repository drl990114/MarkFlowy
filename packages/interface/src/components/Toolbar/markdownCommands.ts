import type { ChangeSpec } from '@codemirror/state'
import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

// URL regex for validating URLs in links/images - simplified version
// Matches common URL patterns and email addresses
const urlRE = /^(https?:\/\/|ftp:\/\/|mailto:|www\.)[^\s]+$/i

export interface ClipboardReadResult {
  text: string
}

export type ClipboardReadFunction = () => Promise<ClipboardReadResult>

function insertLinkOrImage(
  target: EditorView,
  type: 'link' | 'image',
  clipboardRead?: ClipboardReadFunction
) {
  const pre = type === 'image' ? '!' : ''

  const insertWithText = (text: string) => {
    const url = urlRE.test(text || '') ? text : ''

    const transaction = target.state.changeByRange(({ from, to }) => {
      const title = target.state.sliceDoc(from, to)
      let offset = 1
      if (title.length > 0 && url && url.length > 0) {
        offset = 4 + title.length + url.length
      } else if (title.length > 0 && (!url || url.length === 0)) {
        offset = 3 + title.length
      }

      if (type === 'image') {
        offset++
      }

      return {
        changes: { from, to, insert: `${pre}[${title}](${url})` },
        range: EditorSelection.cursor(from + offset),
      }
    })

    target.dispatch(transaction)
  }

  if (clipboardRead) {
    clipboardRead()
      .then(({ text }) => insertWithText(text))
      .catch(() => insertWithText(''))
  } else {
    insertWithText('')
  }

  return true
}

function removeBlockMarkup(line: string): string {
  let match
  if ((match = /^#{1,6}\s+/.exec(line)) !== null) {
    return line.substring(match[0].length)
  } else if ((match = /^(\s{,3})>\s/.exec(line)) !== null) {
    return match[1] + line.substring(match[0].length)
  }
  return line
}

function applyBlockMarkup(target: EditorView, formatting: string): void {
  const transaction = target.state.changeByRange((range) => {
    const startLine = target.state.doc.lineAt(range.from).number
    const endLine = target.state.doc.lineAt(range.to).number

    const changes: ChangeSpec[] = []

    for (let i = startLine; i <= endLine; i++) {
      const line = target.state.doc.line(i)
      const withoutBlocks = removeBlockMarkup(line.text)
      changes.push({ from: line.from, to: line.to, insert: formatting + ' ' + withoutBlocks })
    }

    return { changes, range: EditorSelection.range(range.to, range.to) }
  })

  target.dispatch(transaction)
}

function applyInlineMarkup(target: EditorView, start: string, end: string): void {
  const transaction = target.state.changeByRange((range) => {
    const contents = target.state.sliceDoc(range.from, range.to)
    const before = target.state.sliceDoc(range.from - start.length, range.from)
    const after = target.state.sliceDoc(range.to, range.to + end.length)

    if (before === start && after === end) {
      return {
        changes: {
          from: range.from - start.length,
          to: range.to + end.length,
          insert: contents,
        },
        range: EditorSelection.range(
          range.from - start.length,
          range.from - start.length + contents.length,
        ),
      }
    } else if (contents.startsWith(start) && contents.endsWith(end)) {
      return {
        changes: {
          from: range.from,
          to: range.to,
          insert: contents.substring(start.length, contents.length - end.length),
        },
        range: EditorSelection.range(
          range.from,
          range.from + contents.length - start.length - end.length,
        ),
      }
    } else if (after === end && range.empty) {
      return { range: EditorSelection.cursor(range.to + end.length) }
    } else {
      return {
        changes: { from: range.to, insert: start + contents + end },
        range: EditorSelection.range(
          range.from + start.length,
          range.from + start.length + contents.length,
        ),
      }
    }
  })

  target.dispatch(transaction)
}

function applyList(target: EditorView, type: 'ul' | 'ol' | 'task'): void {
  const transaction = target.state.changeByRange((range) => {
    const startLine = target.state.doc.lineAt(range.from).number
    const endLine = target.state.doc.lineAt(range.to).number

    const changes: ChangeSpec[] = []
    let offsetCharacters = 0

    for (let i = startLine; i <= endLine; i++) {
      const line = target.state.doc.line(i)
      const withoutBlocks = removeBlockMarkup(line.text)
      const formatting = type === 'ol' ? `${i - startLine + 1}.` : type === 'ul' ? '*' : '- [ ]'
      offsetCharacters += line.text.length - withoutBlocks.length + formatting.length + 1
      changes.push({ from: line.from, to: line.to, insert: formatting + ' ' + withoutBlocks })
    }

    return { changes, range: EditorSelection.cursor(range.to + offsetCharacters) }
  })

  target.dispatch(transaction)
}

export function applyBold(target: EditorView): boolean {
  applyInlineMarkup(target, '**', '**')
  return true
}

export function applyItalic(target: EditorView): boolean {
  applyInlineMarkup(target, '*', '*')
  return true
}

export function applyCode(target: EditorView): boolean {
  applyInlineMarkup(target, '`', '`')
  return true
}

export function applyH1(target: EditorView): boolean {
  applyBlockMarkup(target, '#')
  return true
}

export function applyH2(target: EditorView): boolean {
  applyBlockMarkup(target, '##')
  return true
}

export function applyH3(target: EditorView): boolean {
  applyBlockMarkup(target, '###')
  return true
}

export function applyStrikethrough(target: EditorView): boolean {
  applyInlineMarkup(target, '~~', '~~')
  return true
}

export function applyBlockquote(target: EditorView): boolean {
  applyBlockMarkup(target, '>')
  return true
}

export function applyBulletList(target: EditorView): boolean {
  applyList(target, 'ul')
  return true
}

export function applyOrderedList(target: EditorView): boolean {
  applyList(target, 'ol')
  return true
}

export function applyTaskList(target: EditorView): boolean {
  applyList(target, 'task')
  return true
}

export function insertLink(target: EditorView, clipboardRead?: ClipboardReadFunction): boolean {
  return insertLinkOrImage(target, 'link', clipboardRead)
}

export function insertImage(target: EditorView, clipboardRead?: ClipboardReadFunction): boolean {
  return insertLinkOrImage(target, 'image', clipboardRead)
}
