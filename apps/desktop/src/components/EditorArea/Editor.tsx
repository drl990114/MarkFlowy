import { commandRegistry } from '@/commands'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { getFileTypeConfig, isTextfileType } from '@/helper/fileTypeHandler'
import { logger } from '@/helper/logger'
import { isEmptyEditor } from '@/services/editor-file'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { memo, useEffect, useState } from 'react'
import { useMount } from 'react-use'
import { EditorViewType } from 'rme'
import { EmptyState } from './EmptyState'
import { PreviewContent } from './preview/PreviewContent'
import { EditorScrollContainer } from './styles'
import TextEditor from './TextEditor'
import { UnsupportedFileType } from './UnsupportedFileType'

const overlayScrollbarsOptions = {
  scrollbars: {
    theme: 'os-theme-markflowy',
    autoHide: 'leave',
    autoHideDelay: 300,
    dragScroll: true,
    clickScroll: true,
  },
  overflow: {
    x: 'hidden',
    y: 'scroll',
  },
} as const

function Editor(props: EditorProps) {
  const { id, active, visible = active } = props
  const [shouldMountContent, setShouldMountContent] = useState(visible)
  const fileName = useFileCacheStore((state) => state.entries[id]?.name)
  const filePath = useFileCacheStore((state) => state.entries[id]?.path)
  const curFileTypeConfig = useFileTypeConfigStore(
    (state) => state.fileTypeConfigMap.get(id) ?? null,
  )
  const setFileTypeConfig = useFileTypeConfigStore((state) => state.setFileTypeConfig)

  useMount(async () => {
    const curFile = getFileObject(id)
    if (!curFile) return

    const mountStart = Date.now()
    logger.info('[Editor] useMount start', {
      id,
      fileName: curFile.name,
      path: curFile.path,
      mountStart,
    })
    let fileTypeConfig = await getFileTypeConfig(curFile).catch((err) => {
      logger.error('[Editor] getFileTypeConfig rejected', {
        id,
        fileName: curFile.name,
        error: String(err),
      })
      return null
    })
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
    setFileTypeConfig(curFile.id, fileTypeConfig)
    if (fileTypeConfig.type === 'markdown') {
      setTimeout(() => {
        commandRegistry.execute('app:toc_refresh')
      }, 100)
    }
  })

  useEffect(() => {
    if (visible) {
      setShouldMountContent(true)
    }
  }, [visible])

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
    >
      <OverlayScrollbarsComponent
        options={overlayScrollbarsOptions}
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
  active: boolean
  visible?: boolean
  onSave?: () => void
}

export default memo(Editor)
