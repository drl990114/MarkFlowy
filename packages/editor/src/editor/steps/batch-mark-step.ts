import type { Node, Schema } from '@rme-sdk/pm/model'
import { Fragment, Mark, NodeRange, Slice } from '@rme-sdk/pm/model'
import { Step, StepResult } from '@rme-sdk/pm/transform'

import { ReplaceDocStep } from "./replace-doc-step"

export type MarkChunk = [from: number, to: number, marks: Mark[]]

// Replace the marks of multiple ranges in bulk. This is much more efficient
// than creating multiple AddMarkStep and RemoveMarkStep, because it only needs
// to go through the document once to add/remove the marks.
export class BatchSetMarkStep extends Step {
  constructor(readonly chunks: MarkChunk[]) {
    if (chunks.length === 0) {
      throw new RangeError('BatchSetMarkStep: at least one chunk is required')
    }

    let pos = 0
    for (const [from, to] of chunks) {
      if (pos > from || from > to) {
        throw new RangeError('BatchSetMarkStep: chunks must be sorted')
      }
      pos = to
    }

    super()
  }

  apply(doc: Node): StepResult {
    const chunks = this.chunks

    const from = chunks[0][0]
    const to = chunks[chunks.length - 1][1]

    const $from = doc.resolve(from)
    const $to = doc.resolve(to)

    const depth = $from.sharedDepth(to)
    const { start, parent } = new NodeRange($from, $to, depth)

    // We use the `start` from `NodeRange` to make sure that the
    // `oldSlice.openStart` is 0, so that we can calulate the position
    // of nodes correctly.
    const oldSlice = doc.slice(start, to)

    let chunkIndex = 0,
      nodeHi: number,
      chunkLo: number,
      chunkHi: number,
      lo: number,
      hi: number,
      mark: Mark,
      expectedMarks: readonly Mark[],
      marks: readonly Mark[],
      node: Node | null,
      nextNode: Node | null

    const fragment = mapFragment(
      oldSlice.content,
      start,
      parent,
      (inlineNode: Node, parent: Node, nodeLo: number) => {
        node = inlineNode

        const mapped: Node[] = []

        while (node && chunkIndex < chunks.length) {
          nodeHi = nodeLo + node.nodeSize
          ;[chunkLo, chunkHi, expectedMarks] = chunks[chunkIndex]

          // Invalid chunk. Skip it.
          if (chunkLo >= chunkHi) {
            chunkIndex++
            continue
          }

          // chunk and node do not overlap. Check the next node.
          if (chunkLo >= nodeHi) {
            mapped.push(node)
            break
          }

          // chunk and node do not overlap. Check the next chunk.
          if (nodeLo >= chunkHi) {
            chunkIndex++
            continue
          }

          // chunk and node overlap in the range [lo, hi].
          lo = Math.max(chunkLo, nodeLo)
          hi = Math.min(chunkHi, nodeHi)

          if (lo > nodeLo) {
            // The start part of the node is not been covered.
            mapped.push(node.cut(0, lo - nodeLo))
            node = node.cut(lo - nodeLo)
            nodeLo = lo
          }
          if (hi < nodeHi) {
            // The end part of the node is not been covered.
            ;[node, nextNode] = [node.cut(0, hi - nodeLo), node.cut(hi - nodeLo)]
            nodeHi = hi
          }

          marks = node.marks
          for (mark of marks) {
            if (!mark.isInSet(expectedMarks)) {
              marks = mark.removeFromSet(marks)
            }
          }
          for (mark of expectedMarks) {
            if (!mark.isInSet(marks) && parent?.type.allowsMarkType(mark.type)) {
              marks = mark.addToSet(marks)
            }
          }

          node = node.mark(marks)
          mapped.push(node)

          nodeLo += node.nodeSize
          node = nextNode
          nextNode = null
        }
        return mapped
      },
    )

    return StepResult.fromReplace(
      doc,
      start,
      to,
      new Slice(fragment, oldSlice.openStart, oldSlice.openEnd),
    )
  }

  invert(doc: Node): Step {
    return new ReplaceDocStep(doc)
  }

  map(): Step | null {
    return null
  }

  merge(): Step | null {
    return null
  }

  toJSON(): any {
    const chunks = this.chunks.map((chunk) => [
      chunk[0],
      chunk[1],
      chunk[2].map((mark: Mark) => mark.toJSON()),
    ])
    return { stepType: 'batchSetMark', chunks }
  }

  static fromJSON(schema: Schema, json: any): BatchSetMarkStep {
    return new BatchSetMarkStep(
      json.chunks.map((chunk: any) => {
        return [chunk[0], chunk[1], chunk[2].map((mark: any) => Mark.fromJSON(schema, mark))]
      }),
    )
  }
}

try {
  Step.jsonID('batchSetMark', BatchSetMarkStep)
} catch (error) {}

function mapFragment(
  fragment: Fragment,
  start: number,
  parent: Node,
  fn: (inlineNode: Node, textBlockNode: Node, start: number) => Node[],
): Fragment {
  const mapped: Node[] = []
  let offset = start

  for (let i = 0; i < fragment.childCount; i++) {
    let child = fragment.child(i)
    if (child.content.size) {
      child = child.copy(mapFragment(child.content, offset + (child.isLeaf ? 0 : 1), child, fn))
    }
    if (child.isInline) {
      mapped.push(...fn(child, parent, offset))
    } else {
      mapped.push(child)
    }

    offset += child.nodeSize
  }
  return Fragment.fromArray(mapped)
}
