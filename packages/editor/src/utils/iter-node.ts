import type { ProsemirrorNode } from "@remirror/core"
import type { NodeRange } from "@remirror/pm/model"

/**
 * Iterate all children from a parent node. Yield child node, its
 * offset into this parent node and its index.
 *
 * Same function as node.forEach but with two benefits by using
 * ES6 generator:
 * 1. better readability
 * 2. ability to break the loop
 *
 * @param node The parent node
 * @yields {[node, offset, index]}
 */
export function* iterNode(node: ProsemirrorNode): Generator<[ProsemirrorNode, number, number]> {
    const fragment = node.content
    for (let index = 0, offset = 0; index < fragment.childCount; index++) {
        const child = fragment.child(index)
        yield [child, offset, index]
        offset += child.nodeSize
    }
}

/**
 * Iterage all children from a NodeRange object. Yield each child node
 * and its (absolute) position
 *
 * @param range
 * @yields {[node, offset]}
 */
export function* iterNodeRange(range: NodeRange): Generator<[ProsemirrorNode, number]> {
    let pos = range.start + 1
    for (const [child, , index] of iterNode(range.parent)) {
        if (index < range.startIndex) continue
        else if (index >= range.endIndex) break
        yield [child, pos]
        pos += child.nodeSize
    }
}
