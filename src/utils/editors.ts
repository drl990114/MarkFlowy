import type Editor from '@toast-ui/editor'

const editor: { current: null | Editor } = { current: null }

function setMarkDown(mdContent: string) {
  if (editor.current === null)
    return

  editor.current.setMarkdown(mdContent)
}

function setEditor(EditorInstance: Editor) {
  editor.current = EditorInstance
}

export default {
  editor,
  setEditor,
  setMarkDown,
}
