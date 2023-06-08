import CircularProgress from '@mui/material/CircularProgress'
import { HoxRoot } from 'hox'
import { StrictMode, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './normalize.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>
)
