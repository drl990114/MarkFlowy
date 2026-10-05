import {
  changeLng as changeDesktopLanguage,
  i18nInit as initializeDesktopI18n,
} from '@markflowy/i18n/desktop'

export {
  default,
  default as i18n,
  isInitialized,
  useTranslation,
  I18nextProvider,
  getI18n,
  initReactI18next,
  t,
  createInstance,
  locales,
  type Langs,
  type LocaleKey,
  type I18nResources,
} from '@markflowy/i18n/desktop'

// Keep the facade's live bindings in sync when Vite replaces its dependency.
export let i18nInit = initializeDesktopI18n
export let changeLng = changeDesktopLanguage

if (import.meta.hot) {
  import.meta.hot.accept('@markflowy/i18n/desktop', async (updated) => {
    if (!updated) return
    i18nInit = updated.i18nInit
    changeLng = updated.changeLng
    await updated.reloadDesktopResources()
  })
}
