import { getFileObject, getSaveOpenedEditorEntries } from '@/helper/files'
import { checkUnsavedFiles, guardUnsavedFiles } from '@/services/checkUnsavedFiles'
import { addEmptyEditorTab } from '@/services/editor-file'
import { useEditorStore } from '@/stores'
import { memo, useCallback, useRef } from 'react'
import { useTranslation } from '@/i18n'
import { MfIconButton } from '../ui-v2/Button'
import { showContextMenu } from '../ui-v2/ContextMenu'

interface EditorAreaHeaderProps {
  groupId: string
}

export const EditorAreaHeader = memo((props: EditorAreaHeaderProps) => {
  const { groupId } = props
  const group = useEditorStore((state) => state.getGroup(groupId))
  const { setActiveGroupId, closeAllFilesInGroup, splitGroup } = useEditorStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const opened = group?.opened ?? []
  const activeId = group?.activeId
  const curFile = activeId ? getFileObject(activeId) : undefined

  const handleAddTab = useCallback(() => {
    setActiveGroupId(groupId)
    addEmptyEditorTab()
  }, [groupId, setActiveGroupId])

  const handleSplitRight = useCallback(() => {
    guardUnsavedFiles({
      fileIds: activeId ? [activeId] : [],
      labels: {
        save: t('action.save_and_continue'),
        unsaved: t('action.continue_without_save'),
      },
      onContinue: () => {
        splitGroup(groupId, 'horizontal', 'after')
      },
    })
  }, [activeId, groupId, splitGroup, t])

  const handleSplitDown = useCallback(() => {
    guardUnsavedFiles({
      fileIds: activeId ? [activeId] : [],
      labels: {
        save: t('action.save_and_continue'),
        unsaved: t('action.continue_without_save'),
      },
      onContinue: () => {
        splitGroup(groupId, 'vertical', 'after')
      },
    })
  }, [activeId, groupId, splitGroup, t])

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
                  closeAllFilesInGroup(groupId)
                },
                onUnsavedAndClose: () => {
                  closeAllFilesInGroup(groupId)
                },
              }) > 0
            ) {
              return
            }
            closeAllFilesInGroup(groupId)
          },
        },
      ],
    })
  }, [closeAllFilesInGroup, curFile, groupId, opened, t])

  return (
    <div className='editor-area-header'>
      <MfIconButton
        icon={'ri-add-line'}
        rounded='smooth'
        size='small'
        onClick={handleAddTab}
      />
      <MfIconButton
        icon={'ri-layout-right-line'}
        rounded='smooth'
        size='small'
        onClick={handleSplitRight}
        tooltipProps={{ title: t('command.id_descriptions.app_splitEditorRight') }}
      />
      <MfIconButton
        icon={'ri-layout-bottom-line'}
        rounded='smooth'
        size='small'
        onClick={handleSplitDown}
        tooltipProps={{ title: t('command.id_descriptions.app_splitEditorDown') }}
      />
      {curFile ? (
        <>
          <MfIconButton
            iconRef={ref}
            icon={'ri-more-2-fill'}
            rounded='smooth'
            size='small'
            onClick={handleClick}
          />
        </>
      ) : null}
    </div>
  )
})
