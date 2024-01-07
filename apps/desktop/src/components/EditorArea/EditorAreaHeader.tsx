import { memo, useCallback } from 'react'
import { MfIconButton } from '../UI/Button'
import { useCommandStore, useEditorStore } from '@/stores'
import { getFileObject } from '@/helper/files'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'

export const EditorAreaHeader = memo(() => {
  const { activeId } = useEditorStore()
  const { execute } = useCommandStore()
  const { findMark } = useBookMarksStore()
  const curFile = activeId ? getFileObject(activeId) : undefined
  const curBookMark = findMark(curFile?.path || '')

  const handleAddBookMark = useCallback(() => {
    if (curBookMark) {
      execute('edit_bookmark_dialog', curBookMark)
    } else {
      execute('open_bookmark_dialog', curFile)
    }
  }, [curBookMark, curFile, execute])

  return (
    <div className='editor-area-header'>
      {curFile ? <MfIconButton
        icon={curBookMark ? 'ri-bookmark-fill' : 'ri-bookmark-line'}
        tooltipProps={{ title: 'mark it' }}
        onClick={handleAddBookMark}
      /> : null}
    </div>
  )
})
