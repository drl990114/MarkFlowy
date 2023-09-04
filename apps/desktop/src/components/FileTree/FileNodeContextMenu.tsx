import bus from '@/helper/eventBus'
import useFileTreeContextMenu from '@/hooks/useContextMenu'
import { memo } from 'react'
import { ContextMenu } from '../UI/ContextMenu'

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
        bus.emit('SIDEBAR:show-new-input')
      },
    },
    {
      key: 'delete_file',
      label: 'Delete File',
      handler: () => {
        setOpen(false)
        bus.emit("SIDEBAR:delete-file")
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
