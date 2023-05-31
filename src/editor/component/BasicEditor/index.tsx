import { EditorState } from '@/editor/extensions/EditorState'
import { useEditorStore } from '@/stores'
import { IFile } from '@/utils/filesys'
import { EditorExtensions } from '@editor'
import { Remirror, useRemirror } from '@remirror/react'
import { FC, useEffect } from 'react'
import FloatingLinkToolbar from '../../toolbar/FloatingLinkToolbar'
import Text from '../Text'
import Wrapper from '../Wrapper'

const WysiwygEditor: FC<WysiwygEditorProps> = (props) => {
  const { file, content, active } = props
  const { setEditorCtx } = useEditorStore()
  const remirror = useRemirror({
    extensions: EditorExtensions,
    content,
    selection: 'start',
    stringHandler: 'markdown',
  })

  const { manager, state, getContext } = remirror

  useEffect(() => {
    const ctx = getContext()
    setEditorCtx(file.id, {...ctx, getContent: () => ctx?.helpers?.getMarkdown() })
  }, [getContext])

  return (
    <Wrapper className="remirror-wrapper">
      <Remirror
        manager={manager}
        initialContent={state}
      >
        <Text className="h-full w-full overflow-scroll scrollbar-hide markdown-body" />
        <FloatingLinkToolbar />
        <EditorState active={active} file={file} manager={manager}/>
      </Remirror>
    </Wrapper>
  )
}

export default WysiwygEditor

export type EditorChangeHandler = (params: { undoDepth: number }) => void

interface WysiwygEditorProps {
  file: IFile
  content: string
  active: boolean
}
