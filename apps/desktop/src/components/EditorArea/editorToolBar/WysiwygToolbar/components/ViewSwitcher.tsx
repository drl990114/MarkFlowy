import bus from '@/helper/eventBus'
import { getFileObject } from '@/helper/files'
import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import type { LucideIcon } from 'lucide-react'
import { CodeXmlIcon, EyeIcon, PenLineIcon } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from '@/i18n'
import { EditorViewType } from 'rme'
import { EditorAreaActionButton } from '../../../EditorAreaAction'
import { showContextMenu } from '../../../../ui-v2/ContextMenu'

interface ViewSwitcherProps {
  editorId?: string
}

const VIEW_TYPE_ICONS: Record<EditorViewType, LucideIcon> = {
  [EditorViewType.SOURCECODE]: CodeXmlIcon,
  [EditorViewType.WYSIWYG]: PenLineIcon,
  [EditorViewType.PREVIEW]: EyeIcon,
}

export const ViewSwitcher = (props: ViewSwitcherProps) => {
  const { editorId } = props
  const activeId = useEditorStore((state) => state.activeId)
  const targetEditorId = editorId ?? activeId
  const { editorViewTypeMap } = useEditorViewTypeStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLButtonElement>(null)

  const curFile = targetEditorId ? getFileObject(targetEditorId) : undefined
  const editorViewType = editorViewTypeMap.get(curFile?.id || '') || EditorViewType.WYSIWYG

  const handleViewClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return

    const { getFileTypeConfigById } = useFileTypeConfigStore.getState()
    const curFileTypeConfig = getFileTypeConfigById(curFile?.id || '')

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items: [
        {
          label: t('view.source_code'),
          value: EditorViewType.SOURCECODE,
          checked: editorViewType === EditorViewType.SOURCECODE,
          commandId: 'app_toggleEditorType',
          handler: () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE),
        },
        {
          label: t('view.wysiwyg'),
          value: EditorViewType.WYSIWYG,
          checked: editorViewType === EditorViewType.WYSIWYG,
          commandId: 'app_toggleEditorType',
          handler: () => bus.emit('editor_toggle_type', undefined, EditorViewType.WYSIWYG),
        },
        {
          label: t('view.preview'),
          value: EditorViewType.PREVIEW,
          checked: editorViewType === EditorViewType.PREVIEW,
          handler: () => bus.emit('editor_toggle_type', undefined, EditorViewType.PREVIEW),
        },
      ].filter((item) => {
        return curFileTypeConfig ? curFileTypeConfig?.supportedModes?.includes(item.value) : false
      }),
    })
  }, [curFile, editorViewType, t])

  if (!curFile) return null

  const label =
    editorViewType === EditorViewType.SOURCECODE
      ? t('view.source_code')
      : editorViewType === EditorViewType.PREVIEW
        ? t('view.preview')
        : t('view.wysiwyg')

  return (
    <EditorAreaActionButton
      aria-haspopup='menu'
      icon={VIEW_TYPE_ICONS[editorViewType]}
      label={label}
      onClick={handleViewClick}
      ref={ref}
    />
  )
}
