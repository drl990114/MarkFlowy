import type { InitOptions } from 'i18next'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import EN from './en.json'

export async function i18nInit(locales: Record<string, any> = {}, options?: InitOptions) {
  await i18next.use(initReactI18next).init({
    resources: {
      en: {
        translation: EN,
      },
      ...locales,
    },
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    fallbackLng: 'en',
    ...options,
  })
}

export function changeLng(lng?: string) {
  return i18next.changeLanguage(lng)
}
