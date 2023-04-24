import { Remirror, useRemirror } from '@remirror/react'
import { emit } from '@tauri-apps/api/event'
import { EditorExtensions } from '@editor'
import { DataCenter } from '@utils'
import { useEffect } from 'react'
import Wrapper from '../Wrapper'
import Text from './Text'

export default function Editor() {
  const remirror = useRemirror({
    extensions: EditorExtensions,
    content: DataCenter.getData('markdownContent'),
    selection: 'start',
    stringHandler: 'markdown',
  })

  const { manager, state, onChange, getContext } = remirror

  useEffect(() => {
    DataCenter.setRenderEditorCtx(getContext())
  }, [getContext])

  return (
    <Wrapper>
      <Remirror
        manager={manager}
        onChange={(event) => {
          emit('editor_content_change', { content: event.helpers.getMarkdown() })
          onChange(event)
        }}
        initialContent={state}
      >
        <Text className="h-full w-full overflow-scroll scrollbar-hide markdown-body" />
      </Remirror>
    </Wrapper>
  )
}
