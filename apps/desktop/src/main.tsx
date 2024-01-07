import { HoxRoot } from 'hox'
import { StrictMode, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FallBackContainer } from './components/FallBack'
import { enableMapSet } from 'immer'
import { BarLoader } from 'react-spinners'
import { lightTheme } from '@markflowy/theme'
import './normalize.css'

enableMapSet()

const Main = () => {
  return (
    <Suspense
      fallback={
        <FallBackContainer>
          <BarLoader color={lightTheme.styledContants.accentColor} width={200}/>
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
