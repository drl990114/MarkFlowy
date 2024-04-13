import { HoxRoot } from 'hox'
import { StrictMode, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FallBackContainer } from './components/FallBack'
import { enableMapSet } from 'immer'
import { BarLoader } from 'zens'
import { lightTheme } from '@markflowy/theme'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import 'remixicon/fonts/remixicon.css'
import './normalize.css'
import './atom.css'

enableMapSet()
const queryClient = new QueryClient()

const Main = () => {
  return (
    <Suspense
      fallback={
        <FallBackContainer>
          <BarLoader color={lightTheme.styledConstants.accentColor} width={200} />
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
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Main />
        </BrowserRouter>
      </QueryClientProvider>
    </HoxRoot>
  </StrictMode>,
)
