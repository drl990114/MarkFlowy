import { createInstance, editorResources, I18nextProvider, initReactI18next } from '@markflowy/i18n'
import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import React, { useEffect, useMemo } from 'react'
import { darkTheme } from 'theme'
import { preloadRme, useRme, useRmeThemeProvider } from '../hooks/useRme'
import Loading from './Loading'

if (typeof window !== 'undefined') {
  preloadRme().catch((err) => {
    console.warn('RME preload attempt failed, will try again:', err)
  })
}

type RmeProviderProps = {
  themeTokens?: Record<string, string>
  children?: React.ReactNode
}

const INKWASH_EDITOR_TOKENS = {
  primaryFontColor: '#e8e6e3',
  disabledFontColor: '#8a8884',
  unselectedFontColor: '#9a9792',
  labelFontColor: '#8a8884',

  accentColor: '#d4564a',
  accentColorFocused: 'rgba(212, 86, 74, 0.15)',
  borderColor: 'rgba(232, 230, 227, 0.10)',
  borderColorFocused: '#d4564a',
  bgColor: 'transparent',
  bgColorSecondary: '#141416',
  hoverColor: 'rgba(232, 230, 227, 0.06)',
  warnColor: '#d4a017',
  dangerColor: '#d4564a',
  tipsBgColor: '#1c1c20',
  successColor: '#6b9b6b',
  boxShadowColor: '0 30px 60px -20px rgba(0, 0, 0, 0.5)',

  titleBarBgColor: '#141416',
  titleBarDefaultHoverColor: '#1c1c20',
  editorTabBgColor: '#141416',
  editorTabActiveBgColor: '#1c1c20',
  editorToolbarBgColor: '#141416',
  fileTreeIndentLineColor: 'rgba(232, 230, 227, 0.06)',
  fileTreeSelectedBgColor: 'rgba(232, 230, 227, 0.06)',
  sideBarHeaderBgColor: '#141416',
  sideBarBgColor: '#141416',
  statusBarBgColor: '#141416',
  rightBarBgColor: '#141416',
  rightBarHeaderBgColor: '#141416',

  tocbarProgressBgColor: '#141416',
  tocbarProgressActiveBgColor: '#d4564a',

  buttonBgColor: 'rgba(232, 230, 227, 0.08)',
  tooltipBgColor: '#242428',
  dialogBgColor: '#1c1c20',
  dialogBackdropColor: 'rgba(0, 0, 0, 0.6)',
  contextMenuBgColor: '#1c1c20',
  contextMenuBgColorHover: 'rgba(232, 230, 227, 0.06)',

  scrollbarThumbColor: '#3a3a3e',
  scrollbarTrackColor: '#141416',

  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC Light', 'PingFang SC', 'Microsoft YaHei Light', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  codemirrorFontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace",

  nodeSelectedColor: 'rgba(212, 86, 74, 0.15)',
  markBgColor: 'rgba(212, 160, 23, 0.2)',
  markFontColor: '#e8e6e3',
  imgBgColor: '#242428',
  hrBgColor: 'rgba(232, 230, 227, 0.10)',
  hrBorderColor: 'rgba(232, 230, 227, 0.06)',
  placeholderFontColor: '#8a8884',
  kbdBgColor: '#242428',
  kbdBorderColor: 'rgba(232, 230, 227, 0.10)',
  kbdFontColor: '#b0ada8',
  blockquoteBorderColor: '#d4564a',
  blockquoteFontColor: '#9a9792',
  tableTdBorderColor: 'rgba(232, 230, 227, 0.10)',
  tableTrBgColor: '#1c1c20',
  tableTrDeepBgColor: '#141416',
  tableTrBorderColor: 'rgba(232, 230, 227, 0.06)',
  tableSelectorBgColor: 'rgba(232, 230, 227, 0.06)',
  tableSelectorBgHoverColor: 'rgba(232, 230, 227, 0.08)',
  tableSelectorBorderColor: 'rgba(232, 230, 227, 0.10)',
  tableSelectorHightColor: 'rgba(212, 86, 74, 0.15)',
  tableSelectorHightHoverColor: 'rgba(212, 86, 74, 0.25)',
  tableSelectorHightBorderColor: '#d4564a',
  tableSelectorCellBgColor: 'rgba(212, 86, 74, 0.1)',
  tableSelectorCellBorderColor: '#d4564a',
  codeBgColor: '#242428',
  preBgColor: '#141416',
  contextMenuBgColorActive: '#242428',
  slashMenuBorderColor: 'rgba(232, 230, 227, 0.10)',
  selectionMatchBgColor: 'rgba(212, 160, 23, 0.2)',
}

const THEME_CONFIG = {
  mode: 'dark' as const,
  token: {
    ...darkTheme,
    ...INKWASH_EDITOR_TOKENS,
  },
}

function normalizeEditorLang(lng?: string) {
  const lower = (lng || 'en').toLowerCase()
  if (lower.startsWith('zh')) return 'cn'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('fr')) return 'frFR'
  if (lower.startsWith('es')) return 'es'
  return 'en'
}

export const RmePreload = () => {
  useRme()
  return null
}

const RmeProvider: React.FC<RmeProviderProps> = ({ themeTokens, children }) => {
  const { ThemeProvider, loading, error, reload } = useRmeThemeProvider()
  const { i18n } = useTranslation()
  const router = useRouter()

  const editorI18nInstance = useMemo(() => createInstance(), [])

  const i18nProp = useMemo(
    () => ({
      locales: editorResources,
      language: normalizeEditorLang(router.locale || i18n?.language),
    }),
    [router.locale, i18n?.language],
  )

  useEffect(() => {
    const run = async () => {
      if (!editorI18nInstance.isInitialized) {
        await editorI18nInstance.use(initReactI18next).init({
          resources: editorResources,
          interpolation: { escapeValue: false },
          fallbackLng: 'en',
          lng: i18nProp.language,
        })
        return
      }
      await editorI18nInstance.changeLanguage(i18nProp.language)
    }
    run()
  }, [editorI18nInstance, i18nProp.language])

  useEffect(() => {
    if (loading && !ThemeProvider && reload) {
      reload().catch(console.warn)
    }
  }, [loading, ThemeProvider, reload])

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#e8e6e3',
          backgroundColor: '#1c1c20',
        }}
      >
        <p>Error loading RME: {error.message}</p>
        <button
          onClick={() => reload && reload()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#d4564a',
            color: '#fff',
            border: 'none',
            borderRadius: '999px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!ThemeProvider) {
    return <Loading />
  }

  let theme = { ...THEME_CONFIG }
  if (themeTokens) {
    Object.assign(theme.token, themeTokens)
  }

  return (
    <I18nextProvider i18n={editorI18nInstance}>
      <ThemeProvider key={i18nProp.language} theme={theme} i18n={i18nProp}>
        {children}
      </ThemeProvider>
    </I18nextProvider>
  )
}

export default RmeProvider
