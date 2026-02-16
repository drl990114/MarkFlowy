import type { InitOptions } from 'i18next'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import cn_EDITOR from '../../../../locales/editor/cn.json'
import EN_EDITOR from '../../../../locales/editor/en.json'
import es_EDITOR from '../../../../locales/editor/es.json'
import frFR_EDITOR from '../../../../locales/editor/frFR.json'
import ja_EDITOR from '../../../../locales/editor/ja.json'
import EN from '../../../../locales/en.json'
import es from '../../../../locales/es.json'
import frFR from '../../../../locales/fr-FR.json'
import ja from '../../../../locales/ja.json'
import zhCN from '../../../../locales/zh-CN.json'

export const locales = {
  en: 'English',
  cn: '简体中文',
  frFR: 'Français',
  es: 'Español',
  ja: '日本語'
}
export const editorResources = {
  en: { translation: { ...EN_EDITOR.editor } },
  cn: { translation: { ...cn_EDITOR.editor } },
  frFR: { translation: { ...frFR_EDITOR.editor } },
  es: { translation: { ...es_EDITOR.editor } },
  ja: { translation: { ...ja_EDITOR.editor } }
}

export const resources = {
  en: { translation: { ...EN, ...EN_EDITOR } },
  cn: { translation: { ...zhCN, ...cn_EDITOR } },
  frFR: { translation: { ...frFR, ...frFR_EDITOR } },
  es: { translation: { ...es, ...es_EDITOR } },
  ja: { translation: { ...ja, ...ja_EDITOR } }
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
