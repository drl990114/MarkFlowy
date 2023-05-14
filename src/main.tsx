import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HoxRoot } from 'hox'
import CircularProgress from '@mui/material/CircularProgress'
import App from './App'
import { Suspense } from 'react'
import 'virtual:windi.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <HoxRoot>
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="w-screen h-screen fjic">
            <CircularProgress />
          </div>
        }
      >
        <App />
      </Suspense>
    </BrowserRouter>
  </HoxRoot>
)
