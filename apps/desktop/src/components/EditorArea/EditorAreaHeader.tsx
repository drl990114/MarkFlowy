import { getFileObject } from '@/helper/files'
import {
  checkUnsavedFiles,
  guardUnsavedFiles,
  saveUnsavedFiles,
} from '@/services/checkUnsavedFiles'
import { addEmptyEditorTab } from '@/services/editor-file'
import { useEditorStore } from '@/stores'
import { Columns2Icon, EllipsisIcon, PlusIcon } from 'lucide-react'
import { memo, useCallback, useRef } from 'react'
import { useTranslation } from '@/i18n'
import { showContextMenu } from '../ui-v2/ContextMenu'
import { EditorAreaActionButton } from './EditorAreaAction'

interface EditorAreaHeaderProps {
  groupId: string
}

const EMPTY_OPENED_IDS: string[] = []

export const EditorAreaHeader = memo((props: EditorAreaHeaderProps) => {
  const { groupId } = props
  const group = useEditorStore((state) => state.getGroup(groupId))
  const setActiveGroupId = useEditorStore((state) => state.setActiveGroupId)
  const closeAllFilesInGroup = useEditorStore((state) => state.closeAllFilesInGroup)
  const splitGroup = useEditorStore((state) => state.splitGroup)
  const { t } = useTranslation()
  const ref = useRef<HTMLButtonElement>(null)
  const opened = group?.opened ?? EMPTY_OPENED_IDS
  const activeId = group?.activeId
  const curFile = activeId ? getFileObject(activeId) : undefined

  const handleAddTab = useCallback(() => {
    setActiveGroupId(groupId)
    addEmptyEditorTab()
  }, [groupId, setActiveGroupId])

  const handleSplit = useCallback((direction: 'horizontal' | 'vertical') => {
    guardUnsavedFiles({
      fileIds: activeId ? [activeId] : [],
      labels: {
        save: t('action.save_and_continue'),
        unsaved: t('action.continue_without_save'),
      },
      onContinue: () => {
        splitGroup(groupId, direction, 'after')
      },
    })
  }, [activeId, groupId, splitGroup, t])

  const splitRightLabel = t('command.id_descriptions.app_splitEditorRight')
  const splitDownLabel = t('command.id_descriptions.app_splitEditorDown')
  const splitLabel = `${splitRightLabel} · Alt: ${splitDownLabel}`

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
                  if (await saveUnsavedFiles(hasUnsavedFileIds)) {
                    closeAllFilesInGroup(groupId)
                  }
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
  }, [closeAllFilesInGroup, groupId, opened, t])

  return (
    <div className='editor-area-header'>
      <EditorAreaActionButton
        icon={PlusIcon}
        label={t('file.newTab')}
        onClick={handleAddTab}
      />
      <EditorAreaActionButton
        icon={Columns2Icon}
        label={splitLabel}
        onClick={(event) => handleSplit(event.altKey ? 'vertical' : 'horizontal')}
      />
      {curFile ? (
        <EditorAreaActionButton
          ref={ref}
          icon={EllipsisIcon}
          label={t('action.more')}
          onClick={handleClick}
        />
      ) : null}
    </div>
  )
})
