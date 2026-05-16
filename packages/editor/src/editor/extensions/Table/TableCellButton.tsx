import { autoUpdate, useFloating, VirtualElement } from '@floating-ui/react'
import { useCommands } from '@rme-sdk/react'
import React, { useCallback, useEffect } from 'react'

import type { LineTableCellExtension } from './table-extension'
import { useHoveringCellDom } from './use-hovering-cell-dom'

/**
 * Returns the position of the cell menu button.
 */
function useButtonFloating(cellEl: Element | null) {
  const floating = useFloating({
    placement: 'bottom-end',
    middleware: [],
  })

  const { refs, update } = floating

  const updateFloating = useCallback(() => {
    if (!cellEl) return

    const rect = cellEl.getBoundingClientRect()
    const virtualRect = {
      width: rect.width,
      height: 0,
      x: rect.x,
      y: rect.y,
      top: rect.top + rect.height,
      left: rect.left - rect.width * 0.5,
      right: rect.right,
      bottom: rect.top,
    }
    const virtualEl: VirtualElement = {
      getBoundingClientRect() {
        return virtualRect
      },
      contextElement: cellEl,
    }
    refs.setReference(virtualEl)
    update()
  }, [cellEl, refs, update])

  useEffect(() => {
    if (!cellEl || !refs.floating.current) {
      return
    }

    return autoUpdate(cellEl, refs.floating.current, updateFloating)
  }, [cellEl, updateFloating, refs.floating])

  return floating
}

type TableCellButtonComponentProps = {
  cellEl: HTMLElement | null
  handleClick: (event: React.MouseEvent) => void
}

const TableCellButtonComponent: React.FC<TableCellButtonComponentProps> = ({
  cellEl,
  handleClick,
}) => {
  const { x, y, refs, strategy } = useButtonFloating(cellEl)
  const show = Boolean(cellEl)

  return show ? (
    <div
      ref={refs.setFloating}
      style={{
        position: strategy,
        top: y ?? '',
        left: x ?? '',
        zIndex: 10,
        width: '20px',
        height: '20px',
        padding: '8px 0px',
        cursor: 'pointer',
      }}
      onClick={handleClick}
    >
      <i className="ri-delete-bin-line" />
    </div>
  ) : null
}

/**
 * A button that floats above the hovered table cell. When clicked, it shows a menu to operate on the table.
 */
export const TableCellButton: React.FC = () => {
  const cell = useHoveringCellDom()
  const pos = cell?.pos

  const [coords, setCoords] = React.useState<{ x: number; y: number } | null>(null)
  const { selectTableCell } = useCommands<LineTableCellExtension>()

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (pos) {
        selectTableCell({ pos })
        setCoords({ x: event.clientX, y: event.clientY })
      }
    },
    [pos, selectTableCell],
  )

  const handleClose = useCallback(() => {
    setCoords(null)
  }, [])

  return (
    <>
      <TableCellButtonComponent cellEl={cell?.dom ?? null} handleClick={handleClick} />
    </>
  )
}
