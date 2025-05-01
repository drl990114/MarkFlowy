import { getFileObject } from '@/helper/files'
import { getFileTypeConfig, isTextfileType } from '@/helper/fileTypeHandler'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import classNames from 'classnames'
import { memo, useState } from 'react'
import { useMount } from 'react-use'
import { MfCodemirrorView } from 'rme'
import { PreviewContent } from './preview/PreviewContent'
import { EditorPathContainer } from './styles'
import TextEditor from './TextEditor'
import { UnsupportedFileType } from './UnsupportedFileType'

export const sourceCodeCodemirrorViewMap: Map<string, MfCodemirrorView> = new Map()

function Editor(props: EditorProps) {
  const { id, active } = props
  const curFile = getFileObject(id)

  const [showFullPath, setShowFullPath] = useState(false)
  const { getFileTypeConfigById, setFileTypeConfig } = useFileTypeConfigStore()
  const curFileTypeConfig = getFileTypeConfigById(id)

  useMount(async () => {
    const fileTypeConfig = await getFileTypeConfig(curFile)
    if (fileTypeConfig) {
      useEditorViewTypeStore.getState().setEditorViewType(curFile.id, fileTypeConfig.defaultMode)
      setFileTypeConfig(curFile.id, fileTypeConfig)
    }
  })

  const handlePathClick = () => {
    setShowFullPath((prev) => !prev)
  }

  const cls = classNames('code-contents scrollbar', {
    'editor-active': active,
    'display-none': !active,
  })

  const pathCls = classNames({
    'display-none': !active,
  })

  if (!curFileTypeConfig) return null

  return (
    <>
      {curFile.path ? (
        <EditorPathContainer className={pathCls} onClick={handlePathClick}>
          {showFullPath ? curFile.path : `... / ${curFile.name}`}
        </EditorPathContainer>
      ) : null}
      <div className={cls}>
        {curFileTypeConfig.type === 'unsupported' ? (
          <UnsupportedFileType />
        ) : isTextfileType(curFileTypeConfig) ? (
          <TextEditor fileTypeConfig={curFileTypeConfig} active={active} id={id} />
        ) : (
          <PreviewContent type={curFileTypeConfig.type} filePath={curFile.path} active={active} />
        )}
      </div>
    </>
  )
}

export interface EditorProps {
  id: string
  active: boolean
  onSave?: () => void
}

export default memo(Editor)
