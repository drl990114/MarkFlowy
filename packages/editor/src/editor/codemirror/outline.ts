import { ensureSyntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'

interface SourceHeadingMatch {
  from: number
  to: number
  value: string
  type: string
}

/** Read ATX sections in document order. A narrow range can check a cached
 * heading after an edit without collecting every heading in a large document.
 */
export function extractMatches(
  view: Pick<EditorView, 'state'>,
  range?: { from: number; to: number },
): SourceHeadingMatch[] {
  const { state } = view
  const from = range?.from ?? 0
  const to = range?.to ?? state.doc.length
  const matches: SourceHeadingMatch[] = []
  ensureSyntaxTree(state, to)?.iterate({
    from,
    to,
    enter(node) {
      if (node.type.name.startsWith('ATXHeading')) {
        matches.push({
          from: node.from, to: node.to, value: state.doc.sliceString(node.from, node.to), type: node.type.name,
        })
      }
    },
  })
  return matches
}
