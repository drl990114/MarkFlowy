import { commandRegistry } from '@/commands'
import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace'
import { PreviewToolbar } from '@/components/EditorArea/editorToolBar/PreviewToolbar/PreviewToolbar'
import { SourceCodeToolbar } from '@/components/EditorArea/editorToolBar/SourceCodeToolbar/SourceCodeToolbar'
import { WysiwygToolbar } from '@/components/EditorArea/editorToolBar/WysiwygToolbar'
import { EVENT } from '@/constants'
import bus from '@/helper/eventBus'
import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { memo, useEffect } from 'react'
import { EditorViewType } from 'rme'
import Editor from './Editor'
import EditorAreaTabs from './EditorAreaTabs'
import { EmptyState } from './EmptyState'
import { Container, EditorPanel } from './styles'

function EditorArea() {
  const { opened, activeId } = useEditorStore()

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
    <Container className='w-full h-full'>
      <EditorAreaTabs />
      <WysiwygToolbar />
      <SourceCodeToolbar />
      <PreviewToolbar />
      <FindReplace />
      <EditorPanel id="editor-panel">
        {opened.map((id) => {
          return <Editor key={id} id={id} active={id === activeId} />
        })}
      </EditorPanel>
    </Container>
  )
}

export default memo(EditorArea)
