import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { HoxRoot } from 'hox'
import App from './App'
import 'virtual:windi.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HoxRoot>
      <HashRouter>
        <App />
      </HashRouter>
    </HoxRoot>
  </React.StrictMode>,
)
