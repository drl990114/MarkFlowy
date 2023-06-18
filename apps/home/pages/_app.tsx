import { appWithTranslation } from 'next-i18next'
import type { AppProps } from 'next/app'
import './globals.css'

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

// https://github.com/i18next/next-i18next#unserializable-configs
export default appWithTranslation(MyApp)
