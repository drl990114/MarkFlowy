import { Remirror, useRemirror } from '@remirror/react'
import { EditorExtensions } from '@editor'
import { FC, useEffect } from 'react'
import { IFile } from '@/utils/filesys'
import { useEditorStore } from '@/stores'
import Wrapper from '../Wrapper'
import FloatingLinkToolbar from '../../toolbar/FloatingLinkToolbar'
import Text from '../Text'

 const WysiwygEditor: FC<WysiwygEditorProps> = (props) => {
  const { file, content } = props
  const {setEditorCtx} = useEditorStore()
  const remirror = useRemirror({
    extensions: EditorExtensions,
    content,
    selection: 'start',
    stringHandler: 'markdown',
  })

  const { manager, state, getContext } = remirror

  useEffect(() => {
    setEditorCtx(file.id, getContext())
  }, [getContext])

  return (
    <Wrapper className="remirror-wrapper">
      <Remirror
        manager={manager}
        initialContent={state}
      >
        <Text className="h-full w-full overflow-scroll scrollbar-hide markdown-body" />
        <FloatingLinkToolbar />
      </Remirror>
    </Wrapper>
  )
}


export default WysiwygEditor

interface WysiwygEditorProps {
  file: IFile
  content: string
}
