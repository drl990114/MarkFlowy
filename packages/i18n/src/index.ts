import type { InitOptions } from 'i18next'
import i18next, { deepMerge, initialize } from './core'

import ruDesktop from '../../../locales/ru.json'
import enDesktop from '../../../locales/en.json'
import zhDesktop from '../../../locales/zh-CN.json'
import frDesktop from '../../../locales/fr-FR.json'
import esDesktop from '../../../locales/es.json'
import jaDesktop from '../../../locales/ja.json'
import viDesktop from '../../../locales/vi.json'
import viDesktop from '../../../locales/pt-BR.json'

import ruEditor from '../../../locales/editor/ru.json'
import enEditor from '../../../locales/editor/en.json'
import zhEditor from '../../../locales/editor/cn.json'
import frEditor from '../../../locales/editor/frFR.json'
import esEditor from '../../../locales/editor/es.json'
import jaEditor from '../../../locales/editor/ja.json'
import viEditor from '../../../locales/editor/vi.json'
import viEditor from '../../../locales/editor/ptBR.json'

import type { Langs } from './types'

export * from './core'

const langMap = {
  ru: { desktop: ruDesktop, editor: ruEditor },
  en: { desktop: enDesktop, editor: enEditor },
  cn: { desktop: zhDesktop, editor: zhEditor },
  frFR: { desktop: frDesktop, editor: frEditor },
  es: { desktop: esDesktop, editor: esEditor },
  ja: { desktop: jaDesktop, editor: jaEditor },
  vi: { desktop: viDesktop, editor: viEditor },
  ptBR: { desktop: ptBRDesktop, editor: ptBREditor },
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

export async function i18nInit(options?: InitOptions) {
  await initialize({ resources, ...options })
}

export function changeLng(lng: Langs) {
  return i18next.changeLanguage(lng)
}

export default i18next
