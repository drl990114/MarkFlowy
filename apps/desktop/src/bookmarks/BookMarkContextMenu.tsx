import type { ContextMenuProps } from '@/components/UI/ContextMenu'
import { ContextMenu } from '@/components/UI/ContextMenu'
import { useContextMenu } from '@/hooks'
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import type { BookMarkItem } from './useBookMarksStore'
import useBookMarksStore from './useBookMarksStore'
import { useCommandStore } from '@/stores'

export type BookMarkContextMenuRef = {
  open: (args: { x: number; y: number, bookmark: BookMarkItem }) => void
}

export const BookMarkContextMenu = forwardRef<BookMarkContextMenuRef, object>((_props, ref) => {
  const { points, setPoints, setOpen, open } = useContextMenu()
  const { removeBookMark } = useBookMarksStore()
  const { execute } = useCommandStore()
  const [activeBookmark, setActiveBookmark] = useState<BookMarkItem | null>(null)

  useImperativeHandle(ref, () => ({
    open: ({ x, y, bookmark }) => {
      setPoints({
        y,
        x,
      })
      setActiveBookmark(bookmark)
      setOpen(true)
    },
  }))


  const menuData: ContextMenuProps['menuData'] = useMemo(() => [
    {
      key: 'edit',
      label: 'Edit',
      handler: () => {
        setOpen(false)
        execute('edit_bookmark_dialog', activeBookmark)
      }
    },
    {
      key: 'remove',
      label: 'Remove',
      handler: () => {
        setOpen(false)
        removeBookMark(activeBookmark!.id)
      },
    }
  ], [activeBookmark, execute, removeBookMark, setOpen])

  if (!open || !activeBookmark) return null

  return <ContextMenu top={points.y} left={points.x} menuData={menuData} />
})
