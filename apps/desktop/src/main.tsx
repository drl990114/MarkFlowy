import { HoxRoot } from 'hox'
import { StrictMode, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { enableMapSet } from 'immer'
import { Spinners } from 'zens'
import { lightTheme } from '@markflowy/theme'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from "@sentry/react";
import 'remixicon/fonts/remixicon.css'
import './normalize.css'
import './atom.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [],
});

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
