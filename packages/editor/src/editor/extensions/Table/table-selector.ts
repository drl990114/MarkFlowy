import { cx } from '@rme-sdk/core'
import { EditorState } from '@rme-sdk/pm'
import { isCellSelection, TableMap } from '@rme-sdk/pm/tables'
import { Decoration, DecorationSet, EditorView } from '@rme-sdk/pm/view'
import { createElement as h } from '../../utils/dom'
import { selectColumn, selectRow, selectTable } from './table-helpers'
import {
  findTable,
  getCellSelectionRect,
  getCellSelectionType,
  getCellsInColumn,
  getCellsInRect,
  getCellsInRow,
} from './table-utils'

export const DATA_TABLE_SELECTOR_TYPE = 'data-table-selector-type'

const preventDefaultMouseEventHandler = (event: MouseEvent) => {
  event.preventDefault()
}

function createBodySelector(
  view: EditorView,
  getPos: () => number | undefined,
  highlight: boolean,
): HTMLElement {
  const dom = h('div', {
    class: cx(
      'rme-table-body-selector rme-table-selector',
      highlight && 'rme-table-selector-highlight',
    ),
    contenteditable: 'false',
    [DATA_TABLE_SELECTOR_TYPE]: 'body',
    onmousedown: preventDefaultMouseEventHandler,
    onmouseup: preventDefaultMouseEventHandler,
    onclick: (event) => {
      event.preventDefault()
      const pos = getPos()
      if (!pos) return
      const tr = view.state.tr
      if (selectTable(tr, pos)) {
        view.dispatch(tr)
      }
    },
  })

  // Add a grip icon (6 dots)
  dom.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" style="display: block;"><path d="M10 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"></path></svg>`

  return dom
}

function createRowSelector(
  view: EditorView,
  getPos: () => number | undefined,
  highlight: boolean,
): HTMLElement {
  return h('div', {
    class: cx(
      'rme-table-row-selector rme-table-selector',
      highlight && 'rme-table-selector-highlight',
    ),
    contenteditable: 'false',
    [DATA_TABLE_SELECTOR_TYPE]: 'row',
    onmousedown: preventDefaultMouseEventHandler,
    onmouseup: preventDefaultMouseEventHandler,
    onclick: (event) => {
      event.preventDefault()
      const pos = getPos()
      if (!pos) return
      const tr = view.state.tr
      if (selectRow(tr, pos)) {
        view.dispatch(tr)
      }
    },
  })
}

function createColumnSelector(
  view: EditorView,
  getPos: () => number | undefined,
  highlight: boolean,
): HTMLElement {
  return h('div', {
    class: cx(
      'rme-table-column-selector rme-table-selector',
      highlight && 'rme-table-selector-highlight',
    ),
    contenteditable: 'false',
    [DATA_TABLE_SELECTOR_TYPE]: 'column',
    onmousedown: preventDefaultMouseEventHandler,
    onmouseup: preventDefaultMouseEventHandler,
    onclick: (event) => {
      event.preventDefault()
      const pos = getPos()
      if (!pos) return
      const tr = view.state.tr
      if (selectColumn(tr, pos)) {
        view.dispatch(tr)
      }
    },
  })
}

export function createSelectorDecorations(state: EditorState): DecorationSet {
  const { doc, selection } = state

  const table = findTable(selection)

  if (!table) {
    return DecorationSet.empty
  }

  const map = TableMap.get(table.node)

  if (!map.map.length) {
    return DecorationSet.empty
  }

  const decos: Decoration[] = []

  const selectionType = isCellSelection(selection) ? getCellSelectionType(selection) : null

  let minHighlightRow = -1
  let maxHighlightRow = -1
  let minHighlightCol = -1
  let maxHighlightCol = -1

  if (isCellSelection(selection)) {
    if (selectionType === 'table') {
      minHighlightRow = 0
      maxHighlightRow = map.height - 1
      minHighlightCol = 0
      maxHighlightCol = map.width - 1
    } else if (selectionType === 'row') {
      const rect = getCellSelectionRect(selection)
      minHighlightRow = rect.top
      maxHighlightRow = rect.bottom - 1
    } else if (selectionType === 'column') {
      const rect = getCellSelectionRect(selection)
      minHighlightCol = rect.left
      maxHighlightCol = rect.right - 1
    }
  }

  const spec = {
    side: -1,
    ignoreSelection: true,
  } as const

  const cornerCell = getCellsInRect(selection, { top: 0, bottom: 1, left: 0, right: 1 })[0]

  decos.push(
    Decoration.widget(
      cornerCell.pos + 1,
      (view, getPos) => createBodySelector(view, getPos, selectionType === 'table'),
      { ...spec, key: `table-body-selector-${selectionType === 'table'}` },
    ),
  )

  getCellsInColumn(selection, 0).forEach((cell, rowIndex) => {
    const highlight = rowIndex >= minHighlightRow && rowIndex <= maxHighlightRow
    decos.push(
      Decoration.widget(
        cell.pos + 1,
        (view, getPos) => createRowSelector(view, getPos, highlight),
        { ...spec, key: `table-row-selector-${rowIndex}-${highlight}` },
      ),
    )
  })

  getCellsInRow(selection, 0).forEach((cell, colIndex) => {
    const highlight = colIndex >= minHighlightCol && colIndex <= maxHighlightCol
    decos.push(
      Decoration.widget(
        cell.pos + 1,
        (view, getPos) => createColumnSelector(view, getPos, highlight),
        { ...spec, key: `table-column-selector-${colIndex}-${highlight}` },
      ),
    )
  })

  return DecorationSet.create(doc, decos)
}
