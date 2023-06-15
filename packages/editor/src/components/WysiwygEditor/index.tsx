import EditorExtensions from '@/extensions'
import FloatingLinkToolbar from '@/toolbar/FloatingLinkToolbar'
import { Remirror, useRemirror } from '@remirror/react'
import { FC, useEffect } from 'react'
import Text from '../Text'
import Wrapper from '../Wrapper'

const WysiwygEditor: FC<WysiwygEditorProps> = (props) => {
  const { file, content, active, setEditorCtx } = props
  const remirror = useRemirror({
    extensions: EditorExtensions,
    content,
    selection: 'start',
    stringHandler: 'markdown'
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
        <Text className="h-full w-full overflow-auto markdown-body" />
        <FloatingLinkToolbar />
      </Remirror>
    </Wrapper>
  )
}

export default WysiwygEditor

export type EditorChangeHandler = (params: { undoDepth: number }) => void

interface WysiwygEditorProps {
  file: Global.IFile
  content: string
  active: boolean
  setEditorCtx: (id: string, ctx: any) => void
}
