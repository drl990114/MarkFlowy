import { useEffect, useState } from 'react'
import { appWindow } from '@tauri-apps/api/window'
import BasicEditor from './BasicEditor'
import { DualEditor } from './DualEditor'
import '../theme/github-light.css'

type EditorViewType = 'wysiwyg' | 'dual'
function Editor() {
  const [type, setType] = useState('wysiwyg')

  useEffect(() => {
    const unListen = appWindow.listen<EditorViewType>('editor_toggle_type', ({ payload }) => {
      setType(payload)
    })

    return () => {
      unListen.then(fn => fn())
    }
  })

  return type === 'dual' ? <DualEditor /> : <BasicEditor />
}

export default Editor
