import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HoxRoot } from 'hox'
import App from './App'

import 'virtual:windi.css'
import './index.css'



ReactDOM.createRoot(document.getElementById('root')!).render(
  <HoxRoot>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </HoxRoot>
)
