import { ProsemirrorNode } from "@rme-sdk/core";
import { useEditorView } from "@rme-sdk/react-core";

import { useHoveringCell } from "./use-hovering-cell";

/**
 * A hook which returns the table cell node, its position and its HTML element
 * that is currently being hovered over. Returns `null` if no cell is being
 * hovered over.
 */
export function useHoveringCellDom(): { node: ProsemirrorNode; pos: number; dom: HTMLElement } | null {
    const cell = useHoveringCell()
    const view = useEditorView()
    if (cell) {
        const dom = view.nodeDOM(cell.pos)
        if (dom) {
            return {
                node: cell.node,
                pos: cell.pos,
                dom: dom as HTMLElement,
            }
        }
    }
    return null
}
