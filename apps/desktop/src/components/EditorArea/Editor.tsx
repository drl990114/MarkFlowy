import {
  finishEditorOpenMeasurement,
  getEditorOpenMeasurement,
  recordEditorOpenStage,
} from './editorPerformanceDiagnostics'
import { preloadCapricornRuntimeFactory } from './capricornRuntimeAdapter'
import { EditorViewType } from '@/constants/editorViewType'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { getFileTypeConfig, isTextfileType } from '@/helper/fileTypeHandler'
import { logger } from '@/helper/logger'
import { isEmptyEditor } from '@/services/editor-file'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { memo, useEffect, useState, type MouseEventHandler } from 'react'
import { EmptyState } from './EmptyState'
import { isEditorPanelBlankTarget, scheduleActiveEditorFocus } from './focusActiveEditor'
import { PreviewContent } from './preview/PreviewContent'
import { EditorScrollContainer } from './styles'
import { editorScrollOptions } from './editorScrollOptions'
import TextEditor from './TextEditor'
import { UnsupportedFileType } from './UnsupportedFileType'

const handleEditorPanelClick: MouseEventHandler<HTMLDivElement> = (event) => {
  if (!isEditorPanelBlankTarget(event.target, event.currentTarget)) return

  scheduleActiveEditorFocus()
}

function Editor(props: EditorProps) {
  const { id, active, visible = active, groupId } = props
  const [shouldMountContent, setShouldMountContent] = useState(visible)
  const fileName = useFileCacheStore((state) => state.entries[id]?.name)
  const filePath = useFileCacheStore((state) => state.entries[id]?.path)
  const curFileTypeConfig = useFileTypeConfigStore(
    (state) => state.fileTypeConfigMap.get(id) ?? null,
  )
  const setFileTypeConfig = useFileTypeConfigStore((state) => state.setFileTypeConfig)

  useEffect(() => {
    let disposed = false

    const initialize = async () => {
      const curFile = getFileObject(id)
      if (!curFile) return

      const mountStart = Date.now()
      logger.info('[Editor] initialize start', {
        id,
        fileName: curFile.name,
        path: curFile.path,
        mountStart,
      })
      let fileTypeConfig = await getFileTypeConfig(curFile).catch((err) => {
        if (!disposed) {
          logger.error('[Editor] getFileTypeConfig rejected', {
            id,
            fileName: curFile.name,
            error: String(err),
          })
        }
        return null
      })
      if (disposed) return
      if (!fileTypeConfig) {
        logger.warn('[Editor] getFileTypeConfig returned null, using unsupported fallback', {
          id,
          fileName: curFile.name,
        })
        fileTypeConfig = {
          type: 'unsupported' as const,
          supportedModes: [],
          defaultMode: EditorViewType.PREVIEW,
        }
      }
      logger.info(
        `[Editor] fileTypeConfig resolved at ${Date.now()}, elapsed=${Date.now() - mountStart}ms`,
        {
          id,
          fileName: curFile.name,
          type: fileTypeConfig.type,
          defaultMode: fileTypeConfig.defaultMode,
        },
      )
      useEditorViewTypeStore.getState().setEditorViewType(curFile.id, fileTypeConfig.defaultMode)
      recordEditorOpenStage(getEditorOpenMeasurement(id, groupId), 'type-ready', {
        mode: fileTypeConfig.defaultMode,
      })
      if (fileTypeConfig.type === 'markdown') {
        // Start the existing module and Worker warm-up before publishing the
        // config that mounts TextEditor and begins its independent disk read.
        // Do not await: both operations deliberately overlap.
        void preloadCapricornRuntimeFactory()
      }
      setFileTypeConfig(curFile.id, fileTypeConfig)
    }

    void initialize()
    return () => {
      disposed = true
    }
  }, [groupId, id, setFileTypeConfig])

  useEffect(() => {
    if (visible) {
      setShouldMountContent(true)
    }
  }, [visible])

  useEffect(() => {
    if (
      visible &&
      (isEmptyEditor(id) || (curFileTypeConfig && !isTextfileType(curFileTypeConfig)))
    ) {
      finishEditorOpenMeasurement(getEditorOpenMeasurement(id, groupId), 'unverified')
    }
  }, [active, curFileTypeConfig, groupId, id, visible])

  if (isEmptyEditor(id)) {
    if (visible) {
      return <EmptyState />
    } else {
      return null
    }
  }

  if (!curFileTypeConfig) return null

  return (
    <EditorScrollContainer
      data-editor-id={id}
      data-editor-active={active ? 'true' : 'false'}
      style={visible ? undefined : { display: 'none' }}
      tabIndex={-1}
      onClick={handleEditorPanelClick}
    >
      <OverlayScrollbarsComponent
        options={editorScrollOptions}
        style={{ height: '100%', minWidth: 0 }}
      >
        <div className={'code-contents'}>
          {!shouldMountContent ? null : curFileTypeConfig.type === 'unsupported' ? (
            <UnsupportedFileType fileName={fileName || ''} />
          ) : isTextfileType(curFileTypeConfig) ? (
            <TextEditor
              fileTypeConfig={curFileTypeConfig}
              active={active}
              id={id}
              groupId={groupId}
              visible={visible}
            />
          ) : (
            <PreviewContent
              type={curFileTypeConfig.type}
              filePath={filePath}
              active={active}
              visible={visible}
            />
          )}
        </div>
      </OverlayScrollbarsComponent>
    </EditorScrollContainer>
  )
}

export interface EditorProps {
  id: string
  groupId?: string
  active: boolean
  visible?: boolean
  onSave?: () => void
}

export default memo(Editor)
