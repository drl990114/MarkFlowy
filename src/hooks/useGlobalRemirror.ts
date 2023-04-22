import { createGlobalStore } from 'hox'
import { useRemirror } from '@remirror/react'

import {
  BoldExtension,
  CodeBlockExtension,
  HeadingExtension,
  HistoryExtension,
  ItalicExtension,
  MarkdownExtension,
  ShortcutsExtension,
  StrikeExtension,
  UnderlineExtension,
} from 'remirror/extensions'
import { useCallback, useMemo } from 'react'
import { DataCenter } from '@utils'

function extensions() {
  return [
    new HistoryExtension(),
    new MarkdownExtension(),
    new HeadingExtension(),
    new BoldExtension(),
    new ItalicExtension(),
    new UnderlineExtension(),
    new StrikeExtension(),
    new CodeBlockExtension(),
    new ShortcutsExtension(),
  ]
}

function useRemirrorEditor() {
  const remirror = useRemirror({
    extensions,
    content: DataCenter.getData('markdownContent'),
    selection: 'end',
    stringHandler: 'markdown',
  })

  const ctx = useMemo(() => remirror.getContext(), [remirror])

  const setMarkdown = useCallback(
    (content: string) => {
      ctx?.setContent(content)
    },
    [ctx],
  )

  return {
    remirror,
    operater: {
      setMarkdown,
    },
  }
}

const [useGlobalRemirror] = createGlobalStore(useRemirrorEditor)
export default useGlobalRemirror
