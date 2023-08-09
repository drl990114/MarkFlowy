import CircularProgress from '@mui/material/CircularProgress'
import { HoxRoot } from 'hox'
import { StrictMode, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FallBackContainer } from './components/FallBack'
import { enableMapSet } from 'immer'
import './normalize.css'

enableMapSet()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HoxRoot>
      <BrowserRouter>
        <Suspense
          fallback={
            <FallBackContainer>
              <CircularProgress />
            </FallBackContainer>
          }
        >
          <App />
        </Suspense>
      </BrowserRouter>
    </HoxRoot>
  </StrictMode>,
)
