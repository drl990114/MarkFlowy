import { commandRegistry } from '@/commands'
import { getFileObject } from '@/helper/files'
import { getFileTypeConfig, isTextfileType } from '@/helper/fileTypeHandler'
import { logger } from '@/helper/logger'
import { isEmptyEditor } from '@/services/editor-file'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { memo } from 'react'
import { useMount } from 'react-use'
import { EditorViewType } from 'rme'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { EmptyState } from './EmptyState'
import { PreviewContent } from './preview/PreviewContent'
import TextEditor from './TextEditor'
import { UnsupportedFileType } from './UnsupportedFileType'
import { EditorScrollContainer } from './styles'
import 'overlayscrollbars/overlayscrollbars.css'

const overlayScrollbarsOptions = {
  scrollbars: {
    theme: 'os-theme-markflowy',
    autoHide: 'leave',
    autoHideDelay: 300,
    dragScroll: true,
    clickScroll: true,
  },
  overflow: {
    x: 'scroll',
    y: 'scroll',
  },
} as const

function Editor(props: EditorProps) {
  const { id, active } = props
  const curFile = getFileObject(id)

  const { getFileTypeConfigById, setFileTypeConfig } = useFileTypeConfigStore()
  const curFileTypeConfig = getFileTypeConfigById(id)

  useMount(async () => {
    logger.info('[Editor] useMount start', { id, fileName: curFile.name, path: curFile.path })
    let fileTypeConfig = await getFileTypeConfig(curFile).catch((err) => {
      logger.error('[Editor] getFileTypeConfig rejected', { id, fileName: curFile.name, error: String(err) })
      return null
    })
    if (!fileTypeConfig) {
      logger.warn('[Editor] getFileTypeConfig returned null, using unsupported fallback', { id, fileName: curFile.name })
      fileTypeConfig = { type: 'unsupported' as const, supportedModes: [], defaultMode: EditorViewType.PREVIEW }
    }
    logger.info('[Editor] fileTypeConfig resolved', { id, fileName: curFile.name, type: fileTypeConfig.type, defaultMode: fileTypeConfig.defaultMode })
    useEditorViewTypeStore.getState().setEditorViewType(curFile.id, fileTypeConfig.defaultMode)
    setFileTypeConfig(curFile.id, fileTypeConfig)
    if (fileTypeConfig.type === 'markdown') {
      setTimeout(() => {
        commandRegistry.execute('app:toc_refresh')
      }, 100)
    }
  })

  if (isEmptyEditor(curFile.id)) {
    if (active) {
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
      style={active ? undefined : { display: 'none' }}
    >
      <OverlayScrollbarsComponent
        options={overlayScrollbarsOptions}
        style={{ height: '100%' }}
      >
        <div className={'code-contents'}>
          {curFileTypeConfig.type === 'unsupported' ? (
            <UnsupportedFileType fileName={curFile.name} />
          ) : isTextfileType(curFileTypeConfig) ? (
            <TextEditor fileTypeConfig={curFileTypeConfig} active={active} id={id} />
          ) : (
            <PreviewContent type={curFileTypeConfig.type} filePath={curFile.path} active={active} />
          )}
        </div>
      </OverlayScrollbarsComponent>
    </EditorScrollContainer>
  )
}

export interface EditorProps {
  id: string
  active: boolean
  onSave?: () => void
}

export default memo(Editor)
