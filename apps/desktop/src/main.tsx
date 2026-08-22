import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HoxRoot } from 'hox'
import { enableMapSet } from 'immer'
import { StrictMode, useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import 'remixicon/fonts/remixicon.css'
import App from './App'
import AppThemeProvider from './AppThemeProvider'
import { AsyncSurface } from './components/AsyncSurface'
import { RenderErrorBoundary } from './components/RenderErrorBoundary'
import { PdfPrintWindowApp } from './components/EditorArea/pdf-print/PdfPrintWindowApp'
import { getPdfPrintWindowRequest } from './components/EditorArea/pdf-print/pdfPrintWindow'
import { startAppSetup } from './hooks'
import { applyStartupAppearance, readWindowBootstrap } from './startup/appearance'
import { markBootShellReady } from './startup/boot'
import { initSentryAfterShell } from './startup/sentry'
import './atom.css'
import './normalize.css'
import './ui.css'

applyStartupAppearance(readWindowBootstrap())

enableMapSet()

const queryClient = new QueryClient()

const Main = () => {
  return (
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  )
}

const AppRenderFailure = ({ error, reset }: { error: unknown; reset: () => void }) => {
  useLayoutEffect(() => {
    markBootShellReady()
  }, [])

  return (
    <div className='flex h-screen w-screen'>
      <AsyncSurface
        state={{
          status: 'error',
          title: 'Unable to render MarkFlowy',
          description: error instanceof Error ? error.message : undefined,
          retry: reset,
        }}
      >
        {() => null}
      </AsyncSurface>
    </div>
  )
}

const rootElement = document.getElementById('root')!
const pdfPrintWindowRequest = getPdfPrintWindowRequest()
rootElement.addEventListener('dragover', (e) => {
  e.preventDefault()
})
rootElement.addEventListener('drop', (event) => {
  event.preventDefault()
})

if (pdfPrintWindowRequest) {
  document.documentElement.classList.add('mf-pdf-print-window')
  document.body.classList.add('mf-pdf-print-window')
  markBootShellReady()
  ReactDOM.createRoot(rootElement).render(<PdfPrintWindowApp request={pdfPrintWindowRequest} />)
} else {
  initSentryAfterShell()
  void startAppSetup()
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <HoxRoot>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <RenderErrorBoundary
              fallback={({ error, reset }) => (
                <AppRenderFailure error={error} reset={reset} />
              )}
            >
              <Main />
            </RenderErrorBoundary>
          </BrowserRouter>
        </QueryClientProvider>
      </HoxRoot>
    </StrictMode>,
  )
}
