import { Editor } from '@linebyline/react-editor'
import { SideBar } from '@components'
import { Editors } from '@utils'
import '@linebyline/editor/dist/toastui-editor.css'
import { AppContainer } from './styles'

function App() {
  const content = ['# Markdown Editor!', ''].join('\n')

  return (
    <AppContainer>
      <SideBar />
      <div style={{ width: '100%' }}>
          {<Editor onLoad={Editors.setEditor} previewStyle="vertical" initialValue={content} height="100%" />}
      </div>
    </AppContainer>
  )
}

export default App
