import { lightTheme } from '@markflowy/theme'
import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HoxRoot } from 'hox'
import { enableMapSet } from 'immer'
import { StrictMode, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import 'remixicon/fonts/remixicon.css'
import { Spinners } from 'zens'
import App from './App'
import './atom.css'
import './normalize.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [],
})

enableMapSet()

const queryClient = new QueryClient()

const Main = () => {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinners.BarLoader color={lightTheme.styledConstants.accentColor} width={200} />
        </div>
      }
    >
      <App />
    </Suspense>
  )
}

const rootElement = document.getElementById('root')!
rootElement.addEventListener('dragover', (e) => {
  e.preventDefault()
})
rootElement.addEventListener('drop', (event) => {
  event.preventDefault()
  const files = event.dataTransfer?.files
  console.log('Dropped files:', files)
})

ReactDOM.createRoot(rootElement).render(
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
