import type { InitOptions } from 'i18next'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import enDesktop from '../../../locales/en.json'
import zhDesktop from '../../../locales/zh-CN.json'
import frDesktop from '../../../locales/fr-FR.json'
import esDesktop from '../../../locales/es.json'
import jaDesktop from '../../../locales/ja.json'

import enEditor from '../../../locales/editor/en.json'
import zhEditor from '../../../locales/editor/cn.json'
import frEditor from '../../../locales/editor/frFR.json'
import esEditor from '../../../locales/editor/es.json'
import jaEditor from '../../../locales/editor/ja.json'

import type { Langs } from './types'

export { useTranslation, I18nextProvider, getI18n, initReactI18next } from 'react-i18next'
export { t, createInstance } from 'i18next'

export * from './types'

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        (result[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>,
      )
    } else {
      result[key] = source[key]
    }
  }
  return result
}

const langMap = {
  en: { desktop: enDesktop, editor: enEditor },
  cn: { desktop: zhDesktop, editor: zhEditor },
  frFR: { desktop: frDesktop, editor: frEditor },
  es: { desktop: esDesktop, editor: esEditor },
  ja: { desktop: jaDesktop, editor: jaEditor },
} as const

export const desktopResources = Object.fromEntries(
  Object.entries(langMap).map(([key, { desktop }]) => [key, { translation: desktop }]),
)

export const editorResources = Object.fromEntries(
  Object.entries(langMap).map(([key, { editor }]) => [key, { translation: (editor as any).editor }]),
)

export const resources = Object.fromEntries(
  Object.entries(langMap).map(([key, { desktop, editor }]) => [
    key,
    { translation: deepMerge(desktop, (editor as any).editor) },
  ]),
)

let initialized = false

export async function i18nInit(options?: InitOptions) {
  if (initialized) {
    if (options?.lng) {
      await i18next.changeLanguage(options.lng)
    }
    return
  }

  await i18next.use(initReactI18next).init({
    resources,
    interpolation: {
      escapeValue: false,
    },
    fallbackLng: 'en',
    ...options,
  })

  initialized = true
}

export function changeLng(lng: Langs) {
  return i18next.changeLanguage(lng)
}

export function isInitialized() {
  return initialized
}

export default i18next