import { SideBar } from '@components'
import { Editor } from './editor'
import { AppContainer } from './styles'
import { i18nInit } from './i18n'

function App() {
  i18nInit({ lng: 'cn' })

  return (
    <AppContainer>
      <SideBar />
      {<Editor />}
    </AppContainer>
  )
}

export default App
