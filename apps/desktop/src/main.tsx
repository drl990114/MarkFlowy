import { HoxRoot } from 'hox'
import { StrictMode, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FallBackContainer } from './components/FallBack'
import { enableMapSet } from 'immer'
import './normalize.css'
import { Loading } from './components'

enableMapSet()

const Main = () => {
  return (
    <Suspense
      fallback={
        <FallBackContainer>
          <Loading />
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
