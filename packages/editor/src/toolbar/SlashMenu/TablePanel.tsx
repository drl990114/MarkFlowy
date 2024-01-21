/* eslint-disable @typescript-eslint/no-shadow */
import { forwardRef, useState, useImperativeHandle, memo } from 'react'
import type { AnyExtension, CommandsFromExtensions } from 'remirror'
import styled from 'styled-components'

type TablePanelProps = {
  commands: CommandsFromExtensions<AnyExtension>
  closeMenu: () => void
}

type TablePanelRef = {
  createTable: () => void
  handleKeyDown: (e: KeyboardEvent) => boolean | void
}

const TablePanelCell = styled.div.attrs<{ inScope: boolean }>((p) => p)`
  border: 1px solid ${(props) => props.theme.borderColor};
  margin-right: 1px;
  margin-bottom: 1px;
  width: 10px;
  height: 10px;
  background-color: ${(props) =>
    props.inScope ? props.theme.blue : props.theme.contextMenuBgColor};
`
const TablePanel = memo(
  forwardRef<TablePanelRef, TablePanelProps>((props, ref) => {
    const { commands, closeMenu } = props
    const [rowsCount, setRowsCount] = useState(3)
    const [columnsCount, setColumnsCount] = useState(3)

    useImperativeHandle(ref, () => ({
      createTable: () => {
        commands.createTable({ rowsCount, columnsCount, withHeaderRow: false})
      },
      handleKeyDown: (e) => {
        const handleRight = () => {
          setColumnsCount((prev) => prev + 1)
        }
        const handleLeft = () => {
          if (e.metaKey || e.ctrlKey) {
            return true
          }
          setColumnsCount((prev) => (prev - 1 < 1 ? 1 : prev - 1))
          return false
        }
        const handleUp = () => {
          setRowsCount((prev) => (prev - 1 < 1 ? 1 : prev - 1))
        }
        const handleDown = () => {
          setRowsCount((prev) => prev + 1)
        }
        const handleEnter = () => {
          commands.createTable({ rowsCount, columnsCount })
          return false
        }

        if (e.key === 'ArrowRight') {
          return handleRight()
        } else if (e.key === 'ArrowLeft') {
          return handleLeft()
        } else if (e.key === 'ArrowUp') {
          return handleUp()
        } else if (e.key === 'ArrowDown') {
          return handleDown()
        } else if (e.key === 'Enter') {
          return handleEnter()
        }
      },
    }))

    const displayRows = 10
    const displayCols = 6

    return (
      <div>
        <span>
          Rows: {rowsCount} Cols: {columnsCount}
        </span>
        {Array.from({ length: displayRows }).map((_, i) => {
          return (
            <div key={i} style={{ display: 'flex' }}>
              {Array.from({ length: displayCols }).map((_, j) => {
                const inScope = i < rowsCount && j < columnsCount

                return (
                  <TablePanelCell
                    key={j}
                    inScope={inScope}
                    onClick={() => {
                      commands.createTable({
                        rowsCount: i,
                        columnsCount: j,
                        withHeaderRow: false
                      })
                      closeMenu()
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }),
)

export default TablePanel
