import { Editor } from '@toast-ui/react-editor'
import { SideBar } from '@components'
import '@toast-ui/editor/dist/toastui-editor.css'
import { AppContainer } from './styles'
import { EditorsService } from '@services'

const App = () => {
  const content = ['# Markdown Editor!', ''].join('\n')

  return (
    <AppContainer>
      <SideBar />
      <div style={{ width: '100%' }}>
        <Editor
          ref={(el) => {
            EditorsService.setEditor(el?.getInstance())
          }}
          previewStyle="vertical"
          initialValue={content}
          height="100%"
        />
      </div>
    </AppContainer>
  )
}

export default App
