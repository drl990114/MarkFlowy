import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HoxRoot } from 'hox'
import App from './App'
import { CacheManager } from '@utils'
import { i18nInit } from './i18n'

import 'virtual:windi.css'
import './index.css'

i18nInit()
CacheManager.init()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <HoxRoot>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </HoxRoot>
)
