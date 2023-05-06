import { AppInfoDialog, SideBar } from '@components'
import { CacheManager } from '@utils'
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import { useEffect } from 'react'
import { Editor } from './editor'
import { AppContainer } from './styles'
import { changeLng, i18nInit } from './i18n'

i18nInit()
CacheManager.init()

function App() {
  useEffect(() => {
    const updaterinit = async () => {
      // TODO 更新默认的 setting
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
