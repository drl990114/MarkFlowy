import type {
  ApplySchemaAttributes,
  CommandFunction,
  KeyBindings,
  NodeSpecOverride,
} from '@remirror/core'
import type { TableSchemaSpec } from '@remirror/extension-tables'
import {
  TableCellExtension,
  TableExtension,
  TableHeaderCellExtension,
  TableRowExtension,
} from '@remirror/extension-tables'
import { TextSelection } from '@remirror/pm/state'

import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import { buildBlockEnterKeymap } from '../../utils/build-block-enter-keymap'
import { CellSelection } from '@remirror/pm/tables'

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

    return buildBlockEnterKeymap(
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
    )
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
        row.push(replaceNewLines(cellNode.textContent.trim()))
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
    return []
  }

  createCommands() {
    return {
      selectTableCell: ({ pos }: { pos: number }): CommandFunction => {
        return ({ tr, dispatch }): boolean => {
          if (tr.setSelection(CellSelection.create(tr.doc, pos))) {
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
  const replacedStr = str.replace(/\n/g, "")
  return replacedStr
}
