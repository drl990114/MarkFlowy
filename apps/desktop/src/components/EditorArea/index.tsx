import { commandRegistry } from '@/commands'
import { EditorViewType } from '@/constants/editorViewType'
import { EVENT } from '@/constants'
import bus from '@/helper/eventBus'
import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { lazy, memo, Suspense, useEffect } from 'react'
import { EmptyState } from './EmptyState'

const EditorAreaContent = lazy(() => import('./EditorAreaContent'))

function EditorArea() {
  const { opened } = useEditorStore()

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: EVENT.app_toggleEditorType,
      handler: () => {
        console.log('qweqw')
        const { activeId } = useEditorStore.getState()
        if (!activeId) return

        const fileTypeConfig = useFileTypeConfigStore.getState().getFileTypeConfigById(activeId)
        if (!fileTypeConfig) return

        const supportsToggle =
          fileTypeConfig.supportedModes.includes(EditorViewType.SOURCECODE) &&
          fileTypeConfig.supportedModes.includes(EditorViewType.WYSIWYG)

        if (!supportsToggle) return

        const currentViewType = useEditorViewTypeStore.getState().getEditorViewType(activeId)
        const targetViewType =
          currentViewType === EditorViewType.SOURCECODE
            ? EditorViewType.WYSIWYG
            : EditorViewType.SOURCECODE

        bus.emit('editor_toggle_type', undefined, targetViewType)
      },
    })

    return () => disposable.dispose()
  }, [])

  if (opened.length === 0) {
    return <EmptyState />
  }

  return (
    <Suspense fallback={null}>
      <EditorAreaContent />
    </Suspense>
  )
}

export default memo(EditorArea)
