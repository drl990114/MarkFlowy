export const locales = {
  en: 'English',
  cn: '简体中文',
  frFR: 'Français',
  es: 'Español',
  ja: '日本語',
} as const

export type Langs = keyof typeof locales

export type LocaleKey = (typeof locales)[Langs]

export type I18nResources = {
  [key in Langs]?: { translation: Record<string, any> }
}
