import { autoUpdate, flip, hide, offset, shift, useFloating, VirtualElement } from "@floating-ui/react"
import React, { useCallback, useEffect, useState } from "react"

import { useCellSelectionDom } from "./use-cell-selection-dom"

function calcCellSelectionBoundingClientRect(
    cellA: Element,
    cellB: Element,
): {
    top: number
    bottom: number
    left: number
    right: number
} {
    const rectA = cellA.getBoundingClientRect()
    const rectB = cellB.getBoundingClientRect()

    return {
        top: Math.min(rectA.top, rectB.top),
        bottom: Math.max(rectA.bottom, rectB.bottom),
        left: Math.min(rectA.left, rectB.left),
        right: Math.max(rectA.right, rectB.right),
    }
}

type TableMenuButtonProps = {
    handleClick: (event: React.MouseEvent) => void
    anchorCellEl: Element
    headCellEl: Element
}

const TableMenuButton: React.FC<TableMenuButtonProps> = ({ handleClick, anchorCellEl, headCellEl }) => {
    const { x, y, strategy, middlewareData, refs } = useFloatingMenuFloating({ anchorCellEl, headCellEl })
    const referenceHidden = middlewareData.hide?.referenceHidden

    return (
        <div
            ref={refs.setFloating}
            style={{
                position: strategy,
                top: y ?? "",
                left: x ?? "",
                opacity: referenceHidden ? 0 : 1,

                zIndex: 11,
                width: "24px",
                height: "24px",
                cursor: "pointer",
                padding: "8px",
                borderRadius: "4px",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "rgba(0, 0, 0, 0.1)",
                background: "#fff",
            }}
            onClick={handleClick}
        >
           qwe
        </div>
    )
}

function useFloatingMenuFloating({ anchorCellEl: cellA, headCellEl: cellB }: { anchorCellEl: Element; headCellEl: Element }) {
    const useFloatingReturn = useFloating({
        placement: "top",
        middleware: [offset(20), shift(), flip(), hide()],
    })

    const { refs, update } = useFloatingReturn

    const updateFloating = useCallback(() => {
        const { top, bottom, left, right } = calcCellSelectionBoundingClientRect(cellA, cellB)
        const virtualEl: VirtualElement = {
            getBoundingClientRect() {
                return {
                    top,
                    bottom,
                    left,
                    right,

                    x: left,
                    y: top,
                    width: right - left,
                    height: bottom - top,
                }
            },
        }

        refs.setReference(virtualEl)
        update()
    }, [cellA, cellB, refs, update])

    useEffect(() => {
        updateFloating()
    }, [updateFloating])

    useEffect(() => {
        if (!cellA || !refs.floating.current) {
            return
        }
        return autoUpdate(cellA, refs.floating.current, updateFloating)
    }, [cellA, refs.floating, updateFloating])

    return useFloatingReturn
}

/**
 * A button that floats above the selected table cells. When clicked, it shows a menu to operate on the table.
 */
export const TableTooltip: React.FC = () => {
    const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)

    const handleClick = useCallback((event: React.MouseEvent) => {
        setCoords({ x: event.clientX, y: event.clientY })
    }, [])

    const handleClose = useCallback(() => {
        setCoords(null)
    }, [])

    const cells = useCellSelectionDom()

    // If there is only one cell selected, we don't show the tooltip.
    if (!cells || cells.head === cells.anchor) {
        return null
    }

    return (
        <>
            <TableMenuButton handleClick={handleClick} anchorCellEl={cells.anchor} headCellEl={cells.head} />
        </>
    )
}
