import type { CreateExtensionPlugin } from '@rme-sdk/core'
import { isTextSelection, PlainExtension } from '@rme-sdk/core'
import type { Node as ProsemirrorNode } from '@rme-sdk/pm/model'
import type { EditorState } from '@rme-sdk/pm/state'
import { Decoration, DecorationSet } from '@rme-sdk/pm/view'

import { excludeHtmlInlineNodes } from '../../transform/markdown-it-html-inline'
import type { LineMarkAttrs } from './inline-mark-extensions'
import { isAutoHideMark } from './inline-mark-extensions'

type TextAttrs = Partial<LineMarkAttrs & { isAutoHideMark?: boolean }>

function getTextAttrs(textNode: ProsemirrorNode | undefined | null): TextAttrs {
  const attrs: TextAttrs = {}
  for (const mark of textNode?.marks || []) {
    if (excludeHtmlInlineNodes.includes(textNode?.type.name || '')) {
      break
    }
    if (isAutoHideMark(mark.type.name)) {
      attrs.isAutoHideMark = true
    }
    Object.assign(attrs, mark.attrs)
  }
  return attrs
}

function findVisibleMarks(
  textBlock: ProsemirrorNode,
  cursorPos: number,
  textIndex: number,
  includeBefore: boolean,
): [number, number][] {
  const posPairs: [number, number][] = []

  let textStartPos = cursorPos
  for (let i = textIndex; i < textBlock.content.childCount; i++) {
    const textNode = textBlock.content.child(i)
    const info = getTextAttrs(textNode)
    if (info.isAutoHideMark) {
      posPairs.push([textStartPos, textStartPos + textNode.nodeSize])
    }
    textStartPos += textNode.nodeSize
    if (info.depth === 1 && info.last) break
  }

  const infoAfterCursor = getTextAttrs(textBlock.maybeChild(textIndex))
  if (infoAfterCursor.depth === 1 && infoAfterCursor.first && !includeBefore) {
    return posPairs
  }

  let textEndPos = cursorPos
  for (let i = textIndex - 1; i >= 0; i--) {
    const textNode = textBlock.content.child(i)
    const info = getTextAttrs(textNode)
    if (info.isAutoHideMark) {
      posPairs.push([textEndPos - textNode.nodeSize, textEndPos])
    }
    textEndPos -= textNode.nodeSize
    if (info.depth === 1 && info.first) break
  }

  return posPairs
}

function createDecorationPlugin(): CreateExtensionPlugin {
  return {
    props: {
      decorations: (state: EditorState) => {
        if (!isTextSelection(state.selection)) return null

        const $pos = state.selection.$anchor

        const textBlock = $pos.parent
        if (!textBlock.isTextblock) return null

        let posPairs: [number, number][]

        if ($pos.textOffset === 0) {
          posPairs = findVisibleMarks(textBlock, $pos.pos, $pos.index($pos.depth), true)
        } else {
          const textNodeIndex = $pos.index($pos.depth)
          const textNode = textBlock.content.maybeChild(textNodeIndex)
          if (!textNode) return null

          const tokenDepth = getTextAttrs(textNode).depth
          if (!tokenDepth) return null

          posPairs = findVisibleMarks(
            textBlock,
            $pos.pos - $pos.textOffset,
            $pos.index($pos.depth),
            false,
          )
        }

        return DecorationSet.create(
          state.doc,
          posPairs.map(([from, to]) => Decoration.inline(from, to, { class: 'show' })),
        )
      },
    },
  }
}

export class LineInlineDecorationExtension extends PlainExtension {
  get name() {
    return 'inlineDecoration' as const
  }

  createPlugin(): CreateExtensionPlugin {
    return createDecorationPlugin()
  }
}
