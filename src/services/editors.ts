import Editor from '@toast-ui/editor'

let editor: { current: null | Editor } = { current: null }

const setMarkDown = (mdContent: string) => {
  if (editor.current === null) {
    return
  }
  editor.current.setMarkdown(mdContent)
}

const setEditor = (EditorInstance: Editor) => {
  editor.current = EditorInstance
}
export default {
  editor,
  setEditor,
  setMarkDown,
}
