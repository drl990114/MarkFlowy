import Footer from 'components/Footer'
import ThemeProvider from 'components/ThemeProvider'
import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document'
import { ServerStyleSheet } from 'styled-components'
import { darkTheme } from 'theme'

export default class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const sheet = new ServerStyleSheet()
    const originalRenderPage = ctx.renderPage

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />),
        })

      const initialProps = await Document.getInitialProps(ctx)
      return {
        ...initialProps,
        styles: [initialProps.styles, sheet.getStyleElement()],
      }
    } finally {
      sheet.seal()
    }
  }

  render() {
    return (
      <Html data-theme='dark' lang='en'>
        <Head>
          <link rel='preconnect' href='https://fonts.googleapis.com' />
          <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='anonymous' />
        </Head>

        <body>
          <ThemeProvider>
            <div className='root'>
              <Main />
            </div>
          </ThemeProvider>
          <NextScript />
        </body>
      </Html>
    )
  }
}
