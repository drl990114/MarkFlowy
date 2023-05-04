import { AppInfoDialog, SideBar } from '@components'
import { Cache } from '@utils'
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import { useEffect } from 'react'
import { Editor } from './editor'
import { AppContainer } from './styles'
import { changeLng, i18nInit } from './i18n'

i18nInit()
Cache.readCache().then(() => {
  changeLng(Cache.settingData.language)
})

function App() {
  useEffect(() => {
    const updaterinit = async () => {
      const update = await checkUpdate()
      if (update.shouldUpdate)
        await installUpdate()
    }
    updaterinit()
  }, [])

  return (
    <AppContainer>
      <SideBar />
      <Editor />
      <AppInfoDialog />
    </AppContainer>
  )
}

export default App
