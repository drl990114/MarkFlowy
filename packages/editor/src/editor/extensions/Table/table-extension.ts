import type {
    ApplySchemaAttributes,
    CommandFunction,
    Fragment,
    KeyBindings,
    NodeSpecOverride,
} from '@rme-sdk/core'
import { findParentNodeOfType } from '@rme-sdk/core'
import type { TableSchemaSpec } from '@rme-sdk/extension-tables'
import {
    TableCellExtension,
    TableExtension,
    TableHeaderCellExtension,
    TableRowExtension,
} from '@rme-sdk/extension-tables'
import { TextSelection } from '@rme-sdk/pm/state'

import { TableMap } from '@rme-sdk/pm/tables'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import { buildBlockEnterKeymap } from '../../utils/build-block-enter-keymap'
import { selectCell } from './table-helpers'
import { TableSelectorExtension } from './table-selector-extension'
import { findTable } from './table-utils'

enum TABLE_ALIGEN {
  DEFAULT = 1,
  CENTER = 2,
  RIGHT = 3,
  LEFT = 4,
}

export class LineTableExtension extends TableExtension {
  get name() {
    return 'table' as const
  }

  createKeymap = (): KeyBindings => {
    const schema = this.store.schema

    return {
      ...buildBlockEnterKeymap(
        /^\|((?:[^\|]+\|){2,})\s*$/,
        ({ match }) => {
          const texts = match[1]
            .split('|')
            .slice(0, -1) // Remove the empty string at the end
            .map((text) => {
              text = text.trim()
              if (!text) text = ' ' // Prosemirror text doesn't allow empty text
              return schema.text(text)
            })

          const cells1 = texts.map((text) => schema.nodes.tableCell.create(null, text)) // first row
          const cells2 = texts.map(() => schema.nodes.tableCell.create(null)) // second row
          const row1 = schema.nodes.tableRow.create(null, cells1)
          const row2 = schema.nodes.tableRow.create(null, cells2)
          const table = schema.nodes.table.create(null, [row1, row2])
          return table
        },
        ({ tr }) => {
          const $cursor = (tr.selection as TextSelection)?.$cursor
          if (!$cursor) {
            return tr
          } else {
            const depth = $cursor.depth - 1
            const pos = $cursor.posAtIndex($cursor.index(depth) - 1, depth)
            const $pos = tr.doc.resolve(pos)
            return tr.setSelection(TextSelection.near($pos))
          }
        },
      ),
      ArrowUp: ({ state, dispatch }) => {
        const { selection } = state
        const { $head } = selection
        // 检查是否在表格单元格内
        const cell = findParentNodeOfType({ selection: $head, types: 'tableCell' })
        if (!cell) return false

        // 检查光标是否在单元格内容的第一行
        // 获取光标在当前节点中的相对位置
        const cellNode = cell.node
        const cellContent = cellNode.content
        const posInCell = $head.pos - cell.pos - 1 // -1 是因为需要考虑节点的开始标记

        const nodePositions = getNodePositionByCellContent(cellContent)

        // 检查光标是否在第一行
        let isAtFirstLine = posInCell <= nodePositions[0].end
        // 如果不是在第一行 ，让默认行为处理（在单元格内上移）
        if (!isAtFirstLine) return false

        // 获取表格信息
        const table = findTable(selection)
        if (!table) return false

        const map = TableMap.get(table.node)
        const cellPos = cell.pos
        const cellIndex = cellPos - table.start

        // 计算当前单元格在表格中的位置
        // 在 TableMap 中，单元格按行优先顺序存储在 map 数组中
        // 我们需要找出当前单元格在哪一行哪一列
        let cellRow = -1
        let cellCol = -1
        for (let row = 0; row < map.height; row++) {
          for (let col = 0; col < map.width; col++) {
            const index = row * map.width + col
            if (map.map[index] === cellIndex) {
              cellRow = row
              cellCol = col
              break
            }
          }
          if (cellRow !== -1) break
        }

        // 如果找不到单元格位置或已经在第一行，则不处理
        if (cellRow === -1 || cellRow === 0) return false

        // 获取上一行相同列的单元格
        const targetCellIndex = map.map[(cellRow - 1) * map.width + cellCol]
        if (targetCellIndex === undefined) return false

        const targetPos = table.start + targetCellIndex
        const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(targetPos + 1)))
        if (dispatch) dispatch(tr)
        return true
      },
      ArrowDown: ({ state, dispatch }) => {
        const { selection } = state
        const { $head } = selection
        // 检查是否在表格单元格内
        const cell = findParentNodeOfType({ selection: $head, types: 'tableCell' })
        if (!cell) return false

        // 检查光标是否在单元格内容的最后一行
        // 获取光标在当前节点中的相对位置
        const cellNode = cell.node
        const cellContent = cellNode.content
        const posInCell = $head.pos - cell.pos - 1 // -1 是因为需要考虑节点的开始标记
        const nodePositions = getNodePositionByCellContent(cellContent)

        // 检查光标是否在第一行
        let isAtLastLine = posInCell >= nodePositions[nodePositions.length - 1].start
        // 如果不是最后一行，让默认行为处理（在单元格内下移）
        if (!isAtLastLine) return false

        // 获取表格信息
        const table = findTable(selection)
        if (!table) return false

        const map = TableMap.get(table.node)
        const cellPos = cell.pos
        const cellIndex = cellPos - table.start

        // 计算当前单元格在表格中的位置
        // 在 TableMap 中，单元格按行优先顺序存储在 map 数组中
        // 我们需要找出当前单元格在哪一行哪一列
        let cellRow = -1
        let cellCol = -1
        for (let row = 0; row < map.height; row++) {
          for (let col = 0; col < map.width; col++) {
            const index = row * map.width + col
            if (map.map[index] === cellIndex) {
              cellRow = row
              cellCol = col
              break
            }
          }
          if (cellRow !== -1) break
        }

        // 如果找不到单元格位置或已经在最后一行，则不处理
        if (cellRow === -1 || cellRow === map.height - 1) return false

        // 获取下一行相同列的单元格
        const targetCellIndex = map.map[(cellRow + 1) * map.width + cellCol]
        if (targetCellIndex === undefined) return false

        const targetPos = table.start + targetCellIndex
        const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(targetPos + 1)))
        if (dispatch) dispatch(tr)
        return true
      },
    }
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'table',
        node: this.name,
        hasOpenClose: true,
      },
      { type: ParserRuleType.ignore, token: 'thead_open' },
      { type: ParserRuleType.ignore, token: 'thead_close' },
      { type: ParserRuleType.ignore, token: 'tbody_open' },
      { type: ParserRuleType.ignore, token: 'tbody_close' },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    const table: string[][] = []
    const colAligns: TABLE_ALIGEN[] = []
    node.forEach((rowNode, _, rowIndex) => {
      const row: string[] = []
      rowNode.forEach((cellNode, __, colIndex) => {
        let cellText = ''
        for (let i = 0; i < cellNode.childCount; i++) {
          let child = cellNode.child(i)
          if (child.textContent) {
            cellText += child.textContent
          } else if (child.type.name === 'html_br') {
            cellText += '<br/>'
          }
        }
        row.push(replaceNewLines(cellText.trim()))
        if (rowIndex === 0) {
          colAligns[colIndex] = TABLE_ALIGEN.DEFAULT
        }
      })
      table.push(row)
    })
    const colNumber = colAligns.length

    const colWidths = new Array<number>(colNumber)
    table.forEach((row) => {
      row.forEach((cell, colIndex) => {
        if (!colWidths[colIndex]) colWidths[colIndex] = 3
        colWidths[colIndex] = Math.max(cell.length, colWidths[colIndex])
      })
    })

    const spliter: string[] = new Array(colNumber)
    colWidths.forEach((width, colIndex) => {
      switch (colAligns[colIndex]) {
        case TABLE_ALIGEN.LEFT:
          spliter[colIndex] = ':' + '-'.repeat(width - 1)
          break
        case TABLE_ALIGEN.RIGHT:
          spliter[colIndex] = '-'.repeat(width - 1) + ':'
          break
        case TABLE_ALIGEN.CENTER:
          spliter[colIndex] = ':' + '-'.repeat(width - 2) + ':'
          break
        default:
          spliter[colIndex] = '-'.repeat(width)
          break
      }
    })
    table.splice(1, 0, spliter)

    let text = ''
    table.forEach((row) => {
      row.forEach((cell, col) => {
        text += '| '
        const width = colWidths[col]
        if (colAligns[col] === TABLE_ALIGEN.CENTER) {
          const pad = ' '.repeat(Math.round((width - cell.length) / 2))
          text += (pad + cell + pad).padEnd(width)
        } else if (colAligns[col] === TABLE_ALIGEN.RIGHT) {
          text += cell.padStart(width)
        } else {
          text += cell.padEnd(width)
        }
        text += ' '
      })
      text += '|\n'
    })
    text += '\n'

    state.text(text, false)
  }

  public createExtensions() {
    return []
  }
}

export class LineTableRowExtension extends TableRowExtension {
  get name() {
    return 'tableRow' as const
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): TableSchemaSpec {
    return { ...super.createNodeSpec(extra, override), allowGapCursor: false }
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'tr',
        node: this.name,
        hasOpenClose: true,
      },
    ] as const
  }

  public toMarkdown() {}

  public createExtensions() {
    return []
  }
}

export class LineTableHeaderCellExtension extends TableHeaderCellExtension {
  get name() {
    return 'tableHeaderCell' as const
  }

  public fromMarkdown() {
    return [] as const
  }

  public toMarkdown() {}

  public createExtensions() {
    return []
  }
}

export class LineTableCellExtension extends TableCellExtension {
  get name() {
    return 'tableCell' as const
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): TableSchemaSpec {
    return {
      ...super.createNodeSpec(extra, override),
      content: 'inline*',
    }
  }

  createExtensions() {
    return [new TableSelectorExtension()]
  }

  createCommands() {
    return {
      selectTableCell: ({ pos }: { pos: number }): CommandFunction => {
        return ({ tr, dispatch }): boolean => {
          if (selectCell(tr, pos)) {
            dispatch?.(tr)
            return true
          }
          return false
        }
      },
    }
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'th',
        node: this.name,
        hasOpenClose: true,
      },
      {
        type: ParserRuleType.block,
        token: 'td',
        node: this.name,
        hasOpenClose: true,
      },
    ] as const
  }

  public toMarkdown() {}
}

export function replaceNewLines(str: string) {
  const replacedStr = str.replace(/\n/g, '')
  return replacedStr
}

/**
 * 对于给定的子节点数组合并 text 类型，再返回它们在父节点中的位置。
 * @param childs
 */
export function getNodePositionByCellContent(cellContent: Fragment) {
  const nodePositions = [
    {
      start: 0,
      end: cellContent.firstChild?.nodeSize || 0,
      isText: cellContent.firstChild?.isText || false,
    },
  ]
  let prev = nodePositions[0]

  // 首先收集所有文本节点及其位置信息
  for (let i = 1; i < cellContent.childCount; i++) {
    const child = cellContent.child(i)
    if (child.isText && prev?.isText) {
      prev.end += child.nodeSize
    } else {
      const start = prev.end
      nodePositions.push({
        start,
        end: start + child.nodeSize,
        isText: child.isText,
      })
      prev = nodePositions[nodePositions.length - 1]
    }
  }

  return nodePositions
}
