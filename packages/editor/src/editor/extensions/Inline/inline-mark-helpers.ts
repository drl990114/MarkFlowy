import type { EditorSchema, ProsemirrorNode } from '@rme-sdk/pm'
import type { Node, Schema } from '@rme-sdk/pm/model'
import type { Transaction } from '@rme-sdk/pm/state'
import { Transform } from '@rme-sdk/pm/transform'
import type { EditorView } from '@rme-sdk/pm/view'

import type { MarkChunk } from '../../steps/batch-mark-step'
import { BatchSetMarkStep } from '../../steps/batch-mark-step'
import { excludeHtmlInlineNodes } from '../../transform/markdown-it-html-inline'
import { iterNode, iterNodeRange } from '../../utils/iter-node'
import { fromInlineMarkdown } from './from-inline-markdown'
import { InlineDecorateType } from './inline-types'

/**
 * 处理相邻标记块之间的边界情况
 * 当排除节点位于前一个标记块的结束位置时，需要调整前一个标记块的范围
 * 测试用例: *mark*<span>`qwe`
 */
function adjustAdjacentChunkBoundary(
  output: MarkChunk[],
  excludedPositionsInRange: number[],
): void {
  if (excludedPositionsInRange.length === 0 || output.length === 0) {
    return
  }

  const lastChunk = output[output.length - 1]
  const firstExcludedPos = excludedPositionsInRange[0]

  // 如果排除节点正好位于前一个标记块的结束位置，扩展前一个标记块的范围
  if (lastChunk[1] - 1 === firstExcludedPos) {
    lastChunk[0] += 1
    lastChunk[1] += 1
  }
}

function parseTextBlock(tr: Transform, schema: Schema, node: Node, startPos: number, output: MarkChunk[]): void {
  if (!node.textContent) {
    return
  }

  // 收集需要排除的 HTML 内联节点的位置
  const excludedNodePositions: number[] = []
  let currentPos = -1

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    currentPos += child.nodeSize

    if (excludeHtmlInlineNodes.includes(child.type.name)) {
      excludedNodePositions.push(currentPos)
    }
  }

  if (node.type.name === "reference_def") {
    return
  }
  const tokens = fromInlineMarkdown(tr, node.textContent, node)

  if (tokens.length === 0) {
    return
  }

  let totalOffset = 0

  for (const token of tokens) {
    // 创建标记对象
    const expectedMarks = token.marks.map((markName) => schema.marks[markName].create(token.attrs))

    // 计算当前 token 在文本中的位置（考虑之前的偏移量）
    const tokenStart = token.start + totalOffset
    const tokenEnd = token.end + totalOffset

    // 找出在当前 token 范围内的排除节点位置
    const excludedPositionsInRange = excludedNodePositions.filter(
      (pos) => pos >= tokenStart && pos < tokenEnd,
    )
    const offset = excludedPositionsInRange.length


    // 处理相邻标记块之间的边界情况
    adjustAdjacentChunkBoundary(output, excludedPositionsInRange)

    // 添加新的标记块到输出
    output.push([
      startPos + token.start + totalOffset,
      startPos + token.end + totalOffset + offset,
      expectedMarks,
    ])

    totalOffset += offset
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
