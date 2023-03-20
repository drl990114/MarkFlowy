import { Editor } from '@toast-ui/react-editor'
import { SideBar } from '@components'
import '@toast-ui/editor/dist/toastui-editor.css'
import { AppContainer } from './styles'

const App = () => {
  const content = ['# Markdown Editor!', ''].join('\n')

  return (
    <AppContainer>
      <SideBar />
      <div style={{ width: '100%' }}>
        <Editor previewStyle="vertical" initialValue={content} height="100%" />
      </div>
    </AppContainer>
  )
}

export default App
