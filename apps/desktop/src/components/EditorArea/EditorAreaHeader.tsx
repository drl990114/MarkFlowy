import { getFileObject, getSaveOpenedEditorEntries } from '@/helper/files'
import { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { addEmptyEditorTab } from '@/services/editor-file'
import { useCommandStore, useEditorStore } from '@/stores'
import { memo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MfIconButton } from '../UI/Button'
import { showContextMenu } from '../UI/ContextMenu'

export const EditorAreaHeader = memo(() => {
  const { opened, activeId, getEditorDelegate, delAllOpenedFile } = useEditorStore()
  const { execute } = useCommandStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>()
  const curFile = activeId ? getFileObject(activeId) : undefined

  const handleClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items: [
        {
          label: t('contextmenu.editor_tab.close_all'),
          value: 'close_all',
          handler: () => {
            if (
              checkUnsavedFiles({
                fileIds: opened,
                onSaveAndClose: async (hasUnsavedFileIds) => {
                  const saves = hasUnsavedFileIds.map((otherId) =>
                    getSaveOpenedEditorEntries(otherId),
                  )
                  await Promise.all(saves.map((saveHandler) => saveHandler?.()))
                  delAllOpenedFile()
                },
                onUnsavedAndClose: () => {
                  delAllOpenedFile()
                },
              }) > 0
            ) {
              return
            }
            delAllOpenedFile()
          },
        },
      ],
    })
  }, [curFile, getEditorDelegate, execute])

  return (
    <div className='editor-area-header'>
      <MfIconButton icon={'ri-add-line'} onClick={addEmptyEditorTab} />
      {curFile ? (
        <>
          <MfIconButton iconRef={ref} icon={'ri-more-2-fill'} onClick={handleClick} />
        </>
      ) : null}
    </div>
  )
})
