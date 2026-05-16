import { NodeWithPosition } from "@rme-sdk/core"
import { useHover } from "@rme-sdk/react"
import React, { useCallback } from "react"

import { isCellType } from "./table-utils"

/**
 * A hook which returns the table cell node and its position that is currently
 * being hovered over. Returns `null` if no cell is being hovered over.
 */
export function useHoveringCell(): NodeWithPosition | null {
    const [cell, setCell] = React.useState<NodeWithPosition | null>(null)

    useHover(
        useCallback((_, props) => {
            if (!props.hovering) {
                return
            }

            for (const { node, pos } of props.nodes) {
                if (isCellType(node.type)) {
                    setCell({ node, pos })
                    return
                }
            }

            setCell(null)
        }, []),
    )

    return cell
}
