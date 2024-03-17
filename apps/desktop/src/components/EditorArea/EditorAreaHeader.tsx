import { memo, useCallback, useRef } from 'react'
import { MfIconButton } from '../UI/Button'
import { useCommandStore, useEditorStore } from '@/stores'
import { getFileObject } from '@/helper/files'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { showContextMenu } from '../UI/ContextMenu'
import bus from '@/helper/eventBus'
import { useTranslation } from 'react-i18next'

export const EditorAreaHeader = memo(() => {
  const { activeId, getEditorDelegate } = useEditorStore()
  const { execute } = useCommandStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>()
  const curFile = activeId ? getFileObject(activeId) : undefined

  const handleAddBookMark = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return
    const { findMark } = useBookMarksStore.getState()
    const curBookMark = findMark(curFile?.path || '')
    const editDelegate = getEditorDelegate(curFile?.id || '')

    showContextMenu({
      x: rect.x + rect.width,
      y: rect.y + rect.height,
      items: [
        {
          label: t('action.bookmark'),
          value: 'BookMark',
          checked: curBookMark !== undefined,
          handler: () => {
            if (curBookMark) {
              execute('edit_bookmark_dialog', curBookMark)
            } else {
              execute('open_bookmark_dialog', curFile)
            }
          },
        },
        {
          label: t('view.label'),
          value: 'view',
          children: [
            {
              label: t('view.source_code'),
              value: 'sourceCode',
              checked: editDelegate?.view === 'SourceCode',
              handler: () => bus.emit('editor_toggle_type', 'sourceCode'),
            },
            {
              label: t('view.wysiwyg'),
              value: 'wysiwyg',
              checked: editDelegate?.view === 'Wysiwyg',
              handler: () => bus.emit('editor_toggle_type', 'wysiwyg'),
            },
          ],
        },
      ],
    })
  }, [curFile, getEditorDelegate, t, execute])

  return (
    <div className='editor-area-header'>
      {curFile ? (
        <MfIconButton
          iconRef={ref}
          icon={'ri-more-2-fill'}
          onClick={handleAddBookMark}
        />
      ) : null}
    </div>
  )
})
