import { useTranslation } from '@markflowy/i18n'
import { useCommands, useRemirrorContext, type UseMultiPositionerReturn } from '@rme-sdk/sdk/react'
import { useRef, useState } from 'react'
import { Dropdown, type DropdownMenuItem, type MenuItemType } from 'zens'
import type { LineTableExtension } from '../../extensions/Table'
import {
  getSelectedTableColumnAlignment,
  type TableAlignment,
} from '../../extensions/Table/table-utils'
import { editorZIndex } from '../../theme/z-index'

const ActiveCellMenu = (props: ActiveCellMenuProps) => {
  const { positioner } = props
  const commands = useCommands<LineTableExtension>()
  const { getState } = useRemirrorContext({ autoUpdate: true })
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const selectedAlignment = getSelectedTableColumnAlignment(getState())
  const activeAlignment = selectedAlignment === null ? 'left' : selectedAlignment

  const menuItems: DropdownMenuItem[] = [
    {
      key: 'insertColumnBefore',
      label: t('table.insertColumnBefore'),
    },
    {
      key: 'insertColumnAfter',
      label: t('table.insertColumnAfter'),
    },
    {
      key: 'insertRowBefore',
      label: t('table.insertRowBefore'),
    },
    {
      key: 'insertRowAfter',
      label: t('table.insertRowAfter'),
    },
    {
      type: 'divider',
    },
    {
      key: 'deleteColumn',
      label: t('table.deleteColumn'),
      danger: true,
    },
    {
      key: 'deleteRow',
      label: t('table.deleteRow'),
      danger: true,
    },
  ]

  const handleMenuClick = (item: MenuItemType) => {
    switch (item.key) {
      case 'insertColumnBefore':
        commands.addTableColumnBefore?.()
        break
      case 'insertColumnAfter':
        commands.addTableColumnAfter?.()
        break
      case 'insertRowBefore':
        commands.addTableRowBeforeWithAlignment?.()
        break
      case 'insertRowAfter':
        commands.addTableRowAfterWithAlignment?.()
        break
      case 'deleteColumn':
        commands.deleteTableColumn?.()
        break
      case 'deleteRow':
        commands.deleteTableRow?.()
        break
    }
  }

  const handleAlignmentClick = (alignment: TableAlignment) => {
    commands.setTableColumnAlignment?.(alignment)
  }

  const { ref, key, x, y } = positioner

  return (
    <div
      key={key}
      ref={ref}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 20,
        height: 20,
        zIndex: editorZIndex.inlineWidget,
      }}
    >
      <Dropdown
        menu={{
          items: menuItems,
          onClick: handleMenuClick,
          toolbar: {
            items: [
              {
                key: 'left',
                icon: <i className='ri-align-left' aria-hidden />,
                label: t('table.alignLeft'),
                active: activeAlignment === 'left',
              },
              {
                key: 'center',
                icon: <i className='ri-align-center' aria-hidden />,
                label: t('table.alignCenter'),
                active: activeAlignment === 'center',
              },
              {
                key: 'right',
                icon: <i className='ri-align-right' aria-hidden />,
                label: t('table.alignRight'),
                active: activeAlignment === 'right',
              },
            ],
            onClick: (item) => handleAlignmentClick(item.key as TableAlignment),
          },
        }}
        trigger={['click']}
        raw
        open={open}
        onOpenChange={setOpen}
        triggerRef={triggerRef}
        getPopupContainer={() => document.body}
      >
        <div
          ref={triggerRef}
          onMouseDown={(e) => {
            e.preventDefault()
          }}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          style={{ cursor: 'pointer' }}
        >
          <i className="ri-equalizer-line"></i>
        </div>
      </Dropdown>
    </div>
  )
}

export default ActiveCellMenu

interface ActiveCellMenuProps {
  positioner: UseMultiPositionerReturn
}
