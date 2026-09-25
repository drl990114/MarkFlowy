import type { InitOptions, Resource } from 'i18next'
import i18next, { addMissingResources, deepMerge, initialize } from './core'
import { locales, type Langs } from './types'

export * from './core'
export { default } from './core'

const loaders = {
  en: () => Promise.all([import('../../../locales/en.json'), import('../../../locales/editor/en.json')]),
  cn: () => Promise.all([import('../../../locales/zh-CN.json'), import('../../../locales/editor/cn.json')]),
  frFR: () => Promise.all([import('../../../locales/fr-FR.json'), import('../../../locales/editor/frFR.json')]),
  es: () => Promise.all([import('../../../locales/es.json'), import('../../../locales/editor/es.json')]),
  ja: () => Promise.all([import('../../../locales/ja.json'), import('../../../locales/editor/ja.json')]),
}
const pending = new Map<Langs, Promise<Resource>>()
const languageKey = (lng?: string): Langs => lng && Object.prototype.hasOwnProperty.call(locales, lng) ? lng as Langs : 'en'

function loadLanguage(lng: Langs) {
  let resource = pending.get(lng)
  if (!resource) {
    resource = loaders[lng]().then(([desktop, editor]) => ({
      [lng]: { translation: deepMerge(desktop.default, editor.default.editor) },
    })).catch((error: unknown) => {
      pending.delete(lng)
      throw error
    })
    pending.set(lng, resource)
  }
  return resource
}

export async function i18nInit(options?: InitOptions) {
  const lng = languageKey(options?.lng)
  const resources = Object.assign({}, ...await Promise.all(
    [...new Set<Langs>(['en', lng])].map(loadLanguage),
  )) as Resource
  await initialize({ ...options, lng, resources: { ...resources, ...options?.resources } })
}

let languageRequest = 0

export async function changeLng(lng: Langs) {
  const request = ++languageRequest
  const resources = await loadLanguage(lng)
  // A slow earlier selection must not replace the user's newer language.
  if (request !== languageRequest) return i18next.t
  if (!i18next.isInitialized) await i18nInit({ lng })
  else {
    addMissingResources(resources)
    await i18next.changeLanguage(lng)
  }
  return i18next.t
}
