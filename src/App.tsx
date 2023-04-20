import { SideBar } from '@components'
import { Editor } from './editor'
import '@linebyline/editor/dist/toastui-editor.css'
import { AppContainer } from './styles'
import { i18nInit } from './i18n'

function App() {
  const content = ['# Markdown Editor!', ''].join('\n')

  i18nInit({ lng: 'cn' })

  return (
    <AppContainer>
      <SideBar />
      <div style={{ width: '100%', height: '100%', overflow: 'scroll' }}>{<Editor initialValue={content} />}</div>
    </AppContainer>
  )
}

export default App
