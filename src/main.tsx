import CircularProgress from '@mui/material/CircularProgress'
import { HoxRoot } from 'hox'
import { StrictMode, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'virtual:windi.css'
import App from './App'
import { GlobalStyles } from './globalStyles'
import './index.css'

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
          <GlobalStyles>
            <App />
          </GlobalStyles>
        </Suspense>
      </BrowserRouter>
    </HoxRoot>
  </StrictMode>
)
