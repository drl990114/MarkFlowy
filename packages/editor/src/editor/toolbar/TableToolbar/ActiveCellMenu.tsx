import { useCommands, type UseMultiPositionerReturn } from '@rme-sdk/react'
import { useRef, useState } from 'react'
import { useTranslation } from '@markflowy/i18n'
import { Dropdown, DropdownMenuItem } from 'zens'

const ActiveCellMenu = (props: ActiveCellMenuProps) => {
  const { positioner } = props
  const commands = useCommands()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

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

  const handleMenuClick = (item: { key: string }) => {
    switch (item.key) {
      case 'insertColumnBefore':
        commands.addTableColumnBefore?.()
        break
      case 'insertColumnAfter':
        commands.addTableColumnAfter?.()
        break
      case 'insertRowBefore':
        commands.addTableRowBefore?.()
        break
      case 'insertRowAfter':
        commands.addTableRowAfter?.()
        break
      case 'deleteColumn':
        commands.deleteTableColumn?.()
        break
      case 'deleteRow':
        commands.deleteTableRow?.()
        break
    }
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
        zIndex: 1,
      }}
    >
      <Dropdown
        menu={{
          items: menuItems,
          onClick: handleMenuClick,
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
          onClick={() => setOpen(!open)}
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
