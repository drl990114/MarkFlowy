import i18next, { type InitOptions, type Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

export { useTranslation, I18nextProvider, getI18n, initReactI18next } from 'react-i18next'
export { t, createInstance } from 'i18next'
export * from './types'
export default i18next

export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
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

let initialization: Promise<unknown> | undefined

export async function initialize(options: InitOptions) {
  if (!i18next.isInitialized && !initialization) {
    initialization = i18next.use(initReactI18next).init({
      interpolation: { escapeValue: false },
      fallbackLng: 'en',
      ...options,
    }).catch((error: unknown) => {
      initialization = undefined
      throw error
    })
  }
  await initialization
  addMissingResources(options.resources ?? {})
  if (options.lng && i18next.language !== options.lng) await i18next.changeLanguage(options.lng)
}

export function addMissingResources(resources: Resource) {
  for (const [language, namespaces] of Object.entries(resources)) {
    for (const [namespace, translation] of Object.entries(namespaces)) {
      if (!i18next.hasResourceBundle(language, namespace)) {
        i18next.addResourceBundle(language, namespace, translation)
      }
    }
  }
}

export function isInitialized() {
  return Boolean(i18next.isInitialized)
}
