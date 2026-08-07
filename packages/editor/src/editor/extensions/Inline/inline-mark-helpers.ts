import type { EditorSchema, ProsemirrorNode } from '@rme-sdk/sdk/pm'
import type { Node, Schema } from '@rme-sdk/sdk/pm/model'
import type { Transaction } from '@rme-sdk/sdk/pm/state'
import { Transform } from '@rme-sdk/sdk/pm/transform'
import type { EditorView } from '@rme-sdk/sdk/pm/view'

import type { MarkChunk } from '../../steps/batch-mark-step'
import { BatchSetMarkStep } from '../../steps/batch-mark-step'
import { excludeHtmlInlineNodes } from '../../transform/markdown-it-html-inline'
import { iterNode, iterNodeRange } from '../../utils/iter-node'
import { fromInlineMarkdown } from './from-inline-markdown'
import { InlineDecorateType } from './inline-types'

type ExcludedInlineNode = {
  nodeSize: number
  textOffset: number
}

function mapTextOffsetToDocOffset(
  textOffset: number,
  excludedNodes: ExcludedInlineNode[],
  includeNodesAtOffset: boolean,
): number {
  // Excluded inline atoms sit between text offsets. A range ending at that
  // offset stays before the atoms, while a range starting there moves after them.
  let docOffset = textOffset

  for (const excludedNode of excludedNodes) {
    if (
      excludedNode.textOffset > textOffset ||
      (!includeNodesAtOffset && excludedNode.textOffset === textOffset)
    ) {
      break
    }
    docOffset += excludedNode.nodeSize
  }

  return docOffset
}

function appendTokenChunks(
  output: MarkChunk[],
  startPos: number,
  tokenStart: number,
  tokenEnd: number,
  expectedMarks: MarkChunk[2],
  excludedNodes: ExcludedInlineNode[],
): void {
  let segmentStart = mapTextOffsetToDocOffset(tokenStart, excludedNodes, true)
  let previousExcludedOffset = -1

  for (const excludedNode of excludedNodes) {
    const excludedOffset = excludedNode.textOffset
    if (
      excludedOffset <= tokenStart ||
      excludedOffset >= tokenEnd ||
      excludedOffset === previousExcludedOffset
    ) {
      continue
    }

    const segmentEnd = mapTextOffsetToDocOffset(excludedOffset, excludedNodes, false)
    if (segmentStart < segmentEnd) {
      output.push([startPos + segmentStart, startPos + segmentEnd, expectedMarks])
    }
    segmentStart = mapTextOffsetToDocOffset(excludedOffset, excludedNodes, true)
    previousExcludedOffset = excludedOffset
  }

  const segmentEnd = mapTextOffsetToDocOffset(tokenEnd, excludedNodes, false)
  if (segmentStart < segmentEnd) {
    output.push([startPos + segmentStart, startPos + segmentEnd, expectedMarks])
  }
}

function parseTextBlock(tr: Transform, schema: Schema, node: Node, startPos: number, output: MarkChunk[]): void {
  if (!node.textContent) {
    return
  }

  const excludedNodes: ExcludedInlineNode[] = []
  let textOffset = 0

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)

    if (excludeHtmlInlineNodes.includes(child.type.name)) {
      excludedNodes.push({ nodeSize: child.nodeSize, textOffset })
    } else {
      textOffset += child.textContent.length
    }
  }

  if (node.type.name === 'reference_def') {
    return
  }
  const tokens = fromInlineMarkdown(
    tr,
    node.textContent,
    excludedNodes.map((excludedNode) => excludedNode.textOffset),
  )

  if (tokens.length === 0) {
    return
  }

  for (const token of tokens) {
    const expectedMarks = token.marks.map((markName) => schema.marks[markName].create(token.attrs))
    appendTokenChunks(
      output,
      startPos,
      token.start,
      token.end,
      expectedMarks,
      excludedNodes,
    )
  }
}

function parseNode(
  tr: Transform,
  schema: EditorSchema,
  node: Node,
  startPos: number,
  output: MarkChunk[],
): void {
  if (node.attrs.inlineDecorateType === InlineDecorateType.Ignore) {
    return
  }

  if (node.isTextblock) {
    parseTextBlock(tr, schema, node, startPos, output)
  } else {
    node.forEach((child: Node, offset: number) => {
      parseNode(tr, schema, child, startPos + offset + 1, output)
    })
  }
}

function updateNodeMarks(tr: Transform, node: Node, startPos: number, output: MarkChunk[]): void {
  if (!node.isTextblock) {
    for (const [child, offset] of iterNode(node)) {
      updateNodeMarks(tr, child, startPos + offset + 1, output)
    }
  } else {
    const schema = tr.doc.type.schema
    parseNode(tr, schema, node, startPos, output)
  }
}

export function initDocMarks(doc: ProsemirrorNode): ProsemirrorNode {
  const tr = new Transform(doc)
  const output: MarkChunk[] = []
  updateNodeMarks(tr, doc, 0, output)
  if (output.length) {
    tr.step(new BatchSetMarkStep(output))
  }
  return tr.doc
}

export function applySelectionMarks(view: EditorView): void {
  if (view.isDestroyed) return

  const tr = view.state.tr
  tr.setMeta('addToHistory', false)
  if (updateRangeMarks(tr)) {
    view.dispatch(tr)
  }
}

export function applyDocMarks(view: EditorView): void {
  if (view.isDestroyed) return

  const tr = view.state.tr
  if (updateRangeMarks(tr, true)) {
    view.dispatch(tr)
  }
}

export function updateRangeMarks(tr: Transaction, forceUpdateAll?: boolean): boolean {
  tr.setMeta('APPLY_MARKS', true)

  const { $from, $to } = tr.selection
  const range = $from.blockRange($to)

  const output: MarkChunk[] = []
  if (!range || forceUpdateAll) {
    updateNodeMarks(tr, tr.doc, 0, output)
  } else {
    const rangeEnd = range.end
    for (const [child, pos] of iterNodeRange(range)) {
      if (pos < range.start || pos > rangeEnd) {
        continue
      }
      updateNodeMarks(tr, child, pos, output)
    }
  }

  if (output.length === 0) {
    return false
  }

  const docSize = tr.doc.content.size
  const validChunks: MarkChunk[] = []
  for (const [from, to, marks] of output) {
    if (from < 0 || to > docSize || from >= to) {
      continue
    }
    validChunks.push([from, to, marks])
  }

  if (validChunks.length === 0) {
    return false
  }

  try {
    tr.step(new BatchSetMarkStep(validChunks))
  } catch {
    return false
  }

  if (tr.docChanged) {
    return true
  }
  return false
}
