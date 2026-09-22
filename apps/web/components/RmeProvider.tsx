import { createInstance, editorResources, I18nextProvider, initReactI18next } from '@markflowy/i18n'
import { useRouter } from 'next/router'
import React, { useEffect, useMemo } from 'react'
import { applicationTheme, applicationThemes } from '../utils/websiteTheme'
import { useTheme } from '../hooks/useTheme'
import { useRmeThemeProvider } from '../hooks/useRme'
import Loading from './Loading'

type RmeProviderProps = {
  themeTokens?: Record<string, string>
  children?: React.ReactNode
}

function normalizeEditorLang(lng?: string) {
  const lower = (lng || 'en').toLowerCase()
  if (lower.startsWith('zh')) return 'cn'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('fr')) return 'frFR'
  if (lower.startsWith('es')) return 'es'
  return 'en'
}

const RmeProvider: React.FC<RmeProviderProps> = ({ themeTokens, children }) => {
  const { ThemeProvider, loading, error, reload } = useRmeThemeProvider()
  const router = useRouter()
  const { resolvedTheme } = useTheme()

  const editorI18nInstance = useMemo(() => createInstance(), [])

  const i18nProp = useMemo(
    () => ({
      locales: editorResources,
      language: normalizeEditorLang(router.locale),
    }),
    [router.locale],
  )

  const theme = useMemo(
    () => ({
      mode: resolvedTheme,
      token: {
        ...applicationThemes[resolvedTheme],
        ...(themeTokens || {}),
      },
    }),
    [resolvedTheme, themeTokens],
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
          color: applicationTheme.primaryFontColor,
          backgroundColor: applicationTheme.bgColorSecondary,
        }}
      >
        <p>Error loading RME: {error.message}</p>
        <button
          onClick={() => reload && reload()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: applicationTheme.accentColor,
            color: 'var(--on-accent)',
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

  return (
    <I18nextProvider i18n={editorI18nInstance}>
      <ThemeProvider key={i18nProp.language} theme={theme} i18n={i18nProp}>
        {children}
      </ThemeProvider>
    </I18nextProvider>
  )
}

export default RmeProvider
