import { commandRegistry } from '@/commands'
import { AsyncSurface } from '@/components/AsyncSurface'
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'
import { EditorViewType } from '@/constants/editorViewType'
import { EVENT } from '@/constants'
import bus from '@/helper/eventBus'
import { t } from '@/i18n'
import { guardUnsavedFiles } from '@/services/checkUnsavedFiles'
import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { lazy, memo, Suspense, useEffect } from 'react'

const EditorAreaContent = lazy(() => import('./EditorAreaContent'))

function EditorArea() {
  useEffect(() => {
    const toggleEditorTypeDisposable = commandRegistry.registerCommand({
      id: EVENT.app_toggleEditorType,
      handler: () => {
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
    const closeCurrentEditorTabDisposable = commandRegistry.registerCommand({
      id: EVENT.app_closeCurrentEditorTab,
      handler: () => {
        const { activeGroupId, activeId } = useEditorStore.getState()
        if (activeGroupId && activeId) {
          guardUnsavedFiles({
            fileIds: [activeId],
            onContinue: () => {
              useEditorStore.getState().closeFileInGroup(activeGroupId, activeId)
            },
          })
        }
      },
    })
    const splitEditorRightDisposable = commandRegistry.registerCommand({
      id: EVENT.app_splitEditorRight,
      handler: () => {
        const { activeGroupId, activeId } = useEditorStore.getState()
        if (activeGroupId) {
          guardUnsavedFiles({
            fileIds: activeId ? [activeId] : [],
            labels: {
              save: t('action.save_and_continue'),
              unsaved: t('action.continue_without_save'),
            },
            onContinue: () => {
              useEditorStore.getState().splitGroup(activeGroupId, 'horizontal', 'after')
            },
          })
        }
      },
    })
    const splitEditorDownDisposable = commandRegistry.registerCommand({
      id: EVENT.app_splitEditorDown,
      handler: () => {
        const { activeGroupId, activeId } = useEditorStore.getState()
        if (activeGroupId) {
          guardUnsavedFiles({
            fileIds: activeId ? [activeId] : [],
            labels: {
              save: t('action.save_and_continue'),
              unsaved: t('action.continue_without_save'),
            },
            onContinue: () => {
              useEditorStore.getState().splitGroup(activeGroupId, 'vertical', 'after')
            },
          })
        }
      },
    })

    return () => {
      toggleEditorTypeDisposable.dispose()
      closeCurrentEditorTabDisposable.dispose()
      splitEditorRightDisposable.dispose()
      splitEditorDownDisposable.dispose()
    }
  }, [])

  return (
    <RenderErrorBoundary
      fallback={({ error, reset }) => (
        <AsyncSurface
          retryLabel={t('common.retry')}
          state={{
            status: 'error',
            title: 'Unable to render the editor',
            description: error instanceof Error ? error.message : undefined,
            retry: reset,
          }}
        >
          {() => null}
        </AsyncSurface>
      )}
    >
      <Suspense
        fallback={
          <AsyncSurface state={{ status: 'loading', label: t('common.fetching') }}>
            {() => null}
          </AsyncSurface>
        }
      >
        <EditorAreaContent />
      </Suspense>
    </RenderErrorBoundary>
  )
}

export default memo(EditorArea)
