import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const webRoot = new URL('../apps/web/', import.meta.url)
const require = createRequire(new URL('package.json', webRoot))
const config = require('./next-i18next.config.js')

async function loadModule(path, mocks = {}, globals = {}) {
  const url = new URL(path, webRoot)
  const localRequire = createRequire(url)
  const { outputText } = ts.transpileModule(await readFile(url, 'utf8'), {
    fileName: url.pathname,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputText)(
    (specifier) => Object.hasOwn(mocks, specifier) ? mocks[specifier] : localRequire(specifier),
    module,
    module.exports,
    ...Object.values(globals),
  )
  return module.exports
}

test('Next routes and next-i18next server props load the Russian web dictionary', async () => {
  assert.ok(config.i18n.locales.includes('ru'))
  const { serverSideTranslations } = require('next-i18next/serverSideTranslations')
  const { _nextI18Next } = await serverSideTranslations('ru', ['common'], {
    ...config,
    localePath: fileURLToPath(new URL('../locales/web/', import.meta.url)),
  })
  assert.equal(_nextI18Next.initialLocale, 'ru')
  assert.equal(_nextI18Next.initialI18nStore.ru.common.navigation.language, 'Язык')
  assert.equal(_nextI18Next.initialI18nStore.ru.common.home.hero.download, 'Скачать MarkFlowy')
})

test('the language picker selects Russian and sends untranslated guides to the localized index', async () => {
  const calls = []
  const router = {
    locale: 'en', pathname: '/releases', asPath: '/releases?channel=stable', query: { channel: 'stable' },
    push: (...args) => { calls.push(args); return Promise.resolve(true) },
  }
  const document = { cookie: '' }
  const { default: LanguageSwitcher } = await loadModule('components/Nav/LanguageSwitcher.tsx', {
    'next/router': { useRouter: () => router },
    'next-i18next': { useTranslation: () => ({ t: (key) => key }) },
    '../PreferenceMenu': () => null,
  }, { document })
  const menu = LanguageSwitcher({})
  assert.ok(menu.props.options.some(({ value, label }) => value === 'ru' && label === 'Русский'))
  menu.props.onValueChange('ru')
  assert.match(document.cookie, /^NEXT_LOCALE=ru;/)
  assert.deepEqual(calls.pop(), [
    { pathname: '/releases', query: { channel: 'stable' } }, '/releases?channel=stable', { locale: 'ru' },
  ])
  router.pathname = '/docs/[...slug]'
  router.asPath = '/docs/intro'
  LanguageSwitcher({}).props.onValueChange('ru')
  assert.deepEqual(calls.pop(), ['/docs', '/docs', { locale: 'ru' }])
})

test('the web editor receives the Russian language and dictionary', async () => {
  let editorLocale
  const resources = { ru: { translation: { toolbar: { undo: 'Отмена' } } } }
  const { default: RmeProvider } = await loadModule('components/RmeProvider.tsx', {
    '@markflowy/i18n': {
      createInstance: () => ({}), editorResources: resources,
      I18nextProvider: ({ children }) => children,
    },
    'next/router': { useRouter: () => ({ locale: 'ru' }) },
    '../utils/websiteTheme': { applicationTheme: {}, applicationThemes: { dark: {} } },
    '../hooks/useTheme': { useTheme: () => ({ resolvedTheme: 'dark' }) },
    '../hooks/useRme': { useRmeThemeProvider: () => ({
      ThemeProvider: ({ i18n, children }) => { editorLocale = i18n; return children },
      loading: false,
    }) },
    './Loading': () => null,
  })
  renderToStaticMarkup(React.createElement(RmeProvider, null, 'Editor'))
  assert.equal(editorLocale.language, 'ru')
  assert.equal(editorLocale.locales, resources)
})

test('the Russian documentation index links to real English guides with a fallback notice', async () => {
  const markdowns = [
    { slug: '/intro', title: 'intro', locale: 'en' },
    { slug: '/intro', title: 'intro', locale: 'zh' },
  ]
  const sections = await loadModule('utils/sections.tsx', {
    'contentlayer/generated': { allMarkdowns: markdowns },
  })
  assert.deepEqual(Object.values(sections.getSections('ru')).flat(), [markdowns[0]])
  assert.deepEqual(Object.values(sections.getSections('zh')).flat(), [markdowns[1]])
  const linkedLocales = []
  const { default: Documentation } = await loadModule('pages/docs/index.tsx', {
    'next/router': { useRouter: () => ({ locale: 'ru' }) },
    'next-i18next': { useTranslation: () => ({ t: (key) => key }) },
    'next-i18next/serverSideTranslations': {},
    'utils/sections': sections,
    '../../components/DocsLayout': ({ children }) => children,
    '../../components/Link': ({ children, locale }) => {
      linkedLocales.push(locale)
      return React.createElement('a', null, children)
    },
    '../../utils/media': { mobile: () => '', phone: () => '' },
  })
  const html = renderToStaticMarkup(React.createElement(Documentation))
  assert.match(html, /docs.content.fallback/)
  assert.deepEqual(linkedLocales, ['en'])
})

test('untranslated Russian privacy and deep guide links redirect to actual English pages', async () => {
  const nextConfig = await loadModule('next.config.js', {
    'next-contentlayer2': { withContentlayer: (value) => value },
    '@newhighsco/next-plugin-svgr': (value) => value,
  })
  assert.ok(nextConfig.i18n.locales.includes('ru'))
  assert.deepEqual((await nextConfig.redirects()).filter(({ source }) => source.startsWith('/ru/')), [
    { source: '/ru/privacy', destination: '/privacy', permanent: true, locale: false },
    { source: '/ru/docs/:path+', destination: '/docs/:path+', permanent: false, locale: false },
  ])
})
