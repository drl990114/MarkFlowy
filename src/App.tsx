import { AppInfoDialog, SideBar } from '@components'
import { Cache } from '@utils'
import { Editor } from './editor'
import { AppContainer } from './styles'
import { changeLng, i18nInit } from './i18n'

i18nInit()
Cache.readCache().then(() => {
  changeLng(Cache.settingData.language)
})

function App() {
  return (
    <AppContainer>
      <SideBar />
      <Editor />
      <AppInfoDialog />
    </AppContainer>
  )
}

export default App
