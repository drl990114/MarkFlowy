import { getFileObject } from '@/helper/files'
import { getFileTypeConfig, isTextfileType } from '@/helper/fileTypeHandler'
import { isEmptyEditor } from '@/services/editor-file'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import classNames from 'classnames'
import { memo } from 'react'
import { useMount } from 'react-use'
import { EmptyState } from './EmptyState'
import { PreviewContent } from './preview/PreviewContent'
import TextEditor from './TextEditor'
import { UnsupportedFileType } from './UnsupportedFileType'

function Editor(props: EditorProps) {
  const { id, active } = props
  const curFile = getFileObject(id)

  const { getFileTypeConfigById, setFileTypeConfig } = useFileTypeConfigStore()
  const curFileTypeConfig = getFileTypeConfigById(id)

  useMount(async () => {
    const fileTypeConfig = await getFileTypeConfig(curFile)
    if (fileTypeConfig) {
      useEditorViewTypeStore.getState().setEditorViewType(curFile.id, fileTypeConfig.defaultMode)
      setFileTypeConfig(curFile.id, fileTypeConfig)
    }
  })

  const cls = classNames('code-contents', {
    'display-none': !active,
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
    <div className={cls}>
      {curFileTypeConfig.type === 'unsupported' ? (
        <UnsupportedFileType />
      ) : isTextfileType(curFileTypeConfig) ? (
        <TextEditor fileTypeConfig={curFileTypeConfig} active={active} id={id} />
      ) : (
        <PreviewContent type={curFileTypeConfig.type} filePath={curFile.path} active={active} />
      )}
    </div>
  )
}

export interface EditorProps {
  id: string
  active: boolean
  onSave?: () => void
}

export default memo(Editor)
