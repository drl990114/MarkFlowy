import CircularProgress from '@mui/material/CircularProgress'
import { HoxRoot } from 'hox'
import { StrictMode, Suspense, useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FallBackContainer } from './components/FallBack'
import { enableMapSet } from 'immer'
import __MF__ from '@/context'
import './normalize.css'

enableMapSet()

const Main = () => {
  // mount global context
  useLayoutEffect(() => {
    Object.defineProperty(window, '__MF__', {
      writable: false,
      value: __MF__,
    })
  }, [])

  return (
    <Suspense
      fallback={
        <FallBackContainer>
          <CircularProgress />
        </FallBackContainer>
      }
    >
      <App />
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HoxRoot>
      <BrowserRouter>
        <Main />
      </BrowserRouter>
    </HoxRoot>
  </StrictMode>,
)
