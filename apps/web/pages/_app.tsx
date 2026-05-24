import { Analytics } from '@vercel/analytics/react'
import { RmePreload } from 'components/RmeProvider'
import ThemeProvider from 'components/ThemeProvider'
import { appWithTranslation } from 'next-i18next'
import App from 'next/app'
import Head from 'next/head'
import React from 'react'
import 'remixicon/fonts/remixicon.css'
import { createGlobalStyle } from 'styled-components'
import './normalize.css'
import { GlobalStyles as InterfaceGlobalStyles } from '@markflowy/interface'


class MyApp extends App {
  render() {
    const { Component, pageProps } = this.props

    return (
      <>
        <Head>
          <link rel='icon' type='image/png' href='/favicon.png' />
          <link rel='manifest' href='/manifest.json' />
          <meta httpEquiv='X-UA-Compatible' content='IE=edge,chrome=1' />
          <meta
            name='viewport'
            content='width=device-width, initial-scale=1.0, user-scalable=yes'
          />

          <meta name='theme-color' content='#141416' />
        </Head>

        <ThemeProvider data-theme='dark'>
          <ResetStyles />
          <InkWashCSSVariables />
          <InterfaceGlobalStyles />
          <Component {...pageProps} />
          <Analytics />
          <RmePreload />
        </ThemeProvider>
      </>
    )
  }
}

export default appWithTranslation(MyApp)

const InkWashCSSVariables = createGlobalStyle`
  :root {
    --paper: ${(props) => props.theme.webPaper};
    --paper-warm: ${(props) => props.theme.webPaperWarm};
    --paper-dark: ${(props) => props.theme.webPaperDark};
    --ink: ${(props) => props.theme.webInk};
    --ink-soft: ${(props) => props.theme.webInkSoft};
    --ink-mute: ${(props) => props.theme.webInkMute};
    --ink-faint: ${(props) => props.theme.webInkFaint};
    --seal: ${(props) => props.theme.webSeal};
    --seal-soft: ${(props) => props.theme.webSealSoft};
    --ink-wash: ${(props) => props.theme.webInkWash};
    --line: ${(props) => props.theme.webLine};
    --line-soft: ${(props) => props.theme.webLineSoft};
    --line-faint: ${(props) => props.theme.webLineFaint};
    --shadow: ${(props) => props.theme.webShadow};
    --serif: ${(props) => props.theme.webFontSerif};
    --sans: ${(props) => props.theme.webFontSans};
    --body: ${(props) => props.theme.webFontBody};
    --mono: ${(props) => props.theme.webFontMono};
    --paper-deep: #0e0e10;
    --on-paper-light: #1a1a1a;
    --on-paper-light-soft: #383838;
    --on-paper-light-muted: #5a5854;
    --on-paper-light-faint: #8a8884;
    --on-paper-light-line: rgba(26, 26, 26, 0.10);
    --on-paper-light-line-soft: rgba(26, 26, 26, 0.06);
  }
`

const ResetStyles = createGlobalStyle`
  *,::after,::before{background-repeat:no-repeat;box-sizing:inherit}::after,::before{text-decoration:inherit;vertical-align:inherit}html{box-sizing:border-box;cursor:default;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}article,aside,footer,header,nav,section{display:block}body{margin:0}h1{font-size:2em;margin:.67em 0}figcaption,figure,main{display:block}figure{margin:1em 40px}hr{box-sizing:content-box;height:0;overflow:visible}nav ol,nav ul{list-style:none}pre{font-family:monospace,monospace;font-size:1em}a{text-decoration:none;color:inherit;background-color:transparent;-webkit-text-decoration-skip:objects}abbr[title]{border-bottom:none;text-decoration:underline;text-decoration:underline dotted}b,strong{font-weight:inherit}b,strong{font-weight:bolder}code,kbd,samp{font-family:monospace,monospace;font-size:1em}dfn{font-style:italic}mark{background-color:#ff0;color:#000}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}audio,canvas,iframe,img,svg,video{vertical-align:middle}audio,video{display:inline-block}audio:not([controls]){display:none;height:0}img{border-style:none}svg:not(:root){overflow:hidden}table{border-collapse:collapse}button,input,optgroup,select,textarea{margin:0}button,input,select,textarea{background-color:transparent;color:inherit;font-size:inherit;line-height:inherit}button,input{overflow:visible}button,select{text-transform:none}[type=reset],[type=submit],button,html [type=button]{-webkit-appearance:button; cursor: pointer}[type=button]::-moz-focus-inner,[type=reset]::-moz-focus-inner,[type=submit]::-moz-focus-inner,button::-moz-focus-inner{border-style:none;padding:0}[type=button]:-moz-focusring,[type=reset]:-moz-focusring,[type=submit]:-moz-focusring,button:-moz-focusring{outline:1px dotted ButtonText}legend{box-sizing:border-box;color:inherit;display:table;max-width:100%;padding:0;white-space:normal}progress{display:inline-block;vertical-align:baseline}textarea{overflow:auto}[type=checkbox],[type=radio]{box-sizing:border-box;padding:0}[type=number]::-webkit-inner-spin-button,[type=number]::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}[type=search]::-webkit-search-cancel-button,[type=search]::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}details,menu{display:block}summary{display:list-item}canvas{display:inline-block}template{display:none}[hidden]{display:none}

  #__next {
    overflow-x: hidden;
  }

  html, body {
    font-size: 16px;
    line-height: 1.55;
    font-weight: 400;
    font-family: var(--body);
    font-variant-ligatures: common-ligatures;
    font-style: normal;
    padding: 0;
    margin: 0;
    color: var(--ink);
    background-color: var(--paper);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body.sticky {
    overflow: hidden;
  }

  .root {
    position: relative;
  }

  strong {
    font-weight: 600;
  }

  ::selection {
    background: rgba(212, 86, 74, 0.25);
    color: #e8e6e3;
  }
`
