import { guardUnsavedFiles } from '@/services/checkUnsavedFiles'
import { addEmptyEditorTab } from '@/services/editor-file'
import { useEditorStore } from '@/stores'
import { Columns2Icon, PlusIcon } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from '@/i18n'
import { EditorAreaActionButton } from './EditorAreaAction'

interface EditorAreaHeaderProps {
  groupId: string
}

export const EditorAreaHeader = memo((props: EditorAreaHeaderProps) => {
  const { groupId } = props
  const activeId = useEditorStore((state) => state.getGroup(groupId)?.activeId)
  const setActiveGroupId = useEditorStore((state) => state.setActiveGroupId)
  const splitGroup = useEditorStore((state) => state.splitGroup)
  const { t } = useTranslation()

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
    </div>
  )
})
