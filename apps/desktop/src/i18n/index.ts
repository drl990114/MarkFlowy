import type { InitOptions } from 'i18next'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import EN from '../../../../locales/en.json'
import zhCN from '../../../../locales/zh-CN.json'
import frFR from '../../../../locales/fr-FR.json'

export const locales = {
  en: 'English',
  cn: '简体中文',
  frFR: 'Français',
}
export const editorResources = {
  en: { translation: { ...EN.editor } },
  cn: { translation: { ...zhCN.editor } },
  frFR: { translation: { ...frFR.editor } },
}

export const resources = {
  en: { translation: { ...EN } },
  cn: { translation: { ...zhCN } },
  frFR: { translation: { ...frFR } },
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
