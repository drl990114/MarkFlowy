import { MfCodemirrorView } from 'rme'
import { memo, useEffect, useState } from 'react'
import { getFileObject } from '@/helper/files'
import classNames from 'classnames'
import { getFileTypeConfig, isTextfileType } from '@/helper/fileTypeHandler'
import { PreviewContent } from './preview/PreviewContent'
import { EditorPathContainer } from './styles'
import { useMount } from 'react-use'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import TextEditor from './TextEditor'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'

export const sourceCodeCodemirrorViewMap: Map<string, MfCodemirrorView> = new Map()

function Editor(props: EditorProps) {
  const { id, active } = props
  const curFile = getFileObject(id)

  const [showFullPath, setShowFullPath] = useState(false)
  const { getFileTypeConfigById, setFileTypeConfig } = useFileTypeConfigStore()
  const curFileTypeConfig = getFileTypeConfigById(id)

  useMount(async () => {
    const fileTypeConfig = await getFileTypeConfig(curFile.path || '')
    if (fileTypeConfig) {
      useEditorViewTypeStore.getState().setEditorViewType(curFile.id, fileTypeConfig.defaultMode)
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

  useEffect(() => {
    const initFileType = async () => {
      const config = await getFileTypeConfig(curFile.path || '')
      setFileTypeConfig(curFile.id, config)
    }
    initFileType()
  }, [curFile.path])

  if (!curFileTypeConfig) return null

  return (
    <>
      {curFile.path ? (
        <EditorPathContainer className={pathCls} onClick={handlePathClick}>
          {showFullPath ? curFile.path : `... / ${curFile.name}`}
        </EditorPathContainer>
      ) : null}
      <div className={cls}>
        {isTextfileType(curFileTypeConfig) ? (
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
