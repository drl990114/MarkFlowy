import bus from '@/helper/eventBus'
import useFileTreeContextMenu from '@/hooks/useContextMenu'
import { memo } from 'react'
import { ContextMenu } from '../UI/ContextMenu'
import { EVENT } from '@/constants'

export const FileNodeContextMenu = memo((props: ContextMenuProps) => {
  const { open, setOpen } = useFileTreeContextMenu()
  const { ...positionProps } = props

  if (!open) return null

  const ContextMenuItems = [
    {
      key: 'add_file',
      label: 'Add File',
      handler: () => {
        setOpen(false)
        bus.emit(EVENT.sidebar_show_new_input)
      },
    },
    {
      key: 'delete_file',
      label: 'Delete File',
      handler: () => {
        setOpen(false)
        bus.emit(EVENT.sidebar_delete_file)
      }
    }
  ]

  return (
    <ContextMenu {...positionProps} menuData={ContextMenuItems}/>
  )
})

interface ContextMenuProps {
  top: number
  left: number
}
