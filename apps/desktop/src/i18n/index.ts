import type { InitOptions } from 'i18next'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import EN from '../../../../locales/en.json'
import zhCN from '../../../../locales/zh-CN.json'
import frFR from '../../../../locales/fr-FR.json'
import es from '../../../../locales/es.json'
import ja from '../../../../locales/ja.json'

export const locales = {
  en: 'English',
  cn: '简体中文',
  frFR: 'Français',
  es: 'Español',
  ja: '日本語'
}
export const editorResources = {
  en: { translation: { ...EN.editor } },
  cn: { translation: { ...zhCN.editor } },
  frFR: { translation: { ...frFR.editor } },
  es: { translation: { ...es.editor } },
  ja: { translation: { ...ja.editor } }
}

export const resources = {
  en: { translation: { ...EN } },
  cn: { translation: { ...zhCN } },
  frFR: { translation: { ...frFR } },
  es: { translation: { ...es } },
  ja: { translation: { ...ja } }
} as const

export async function i18nInit(options?: InitOptions) {
  await i18next.use(initReactI18next).init({
    resources,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    fallbackLng: 'en',
    ...options,
  })
}

export function changeLng(lng: Langs) {
  return i18next.changeLanguage(lng)
}

export type Langs = keyof typeof locales
