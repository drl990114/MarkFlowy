import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { loadPublicMarkdownSources } from './web-document-sources.mjs'

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

test('homepage and desktop/mobile menu links target published guides in every site language', async () => {
  const previousI18nSupport = process.env.__NEXT_I18N_SUPPORT
  process.env.__NEXT_I18N_SUPPORT = 'true'
  try {
    const { RouterContext } = require('next/dist/shared/lib/router-context.shared-runtime')
    const publicContent = await loadModule('utils/publicContent.ts')
    const website = await loadModule('utils/website.ts')
    const navigation = await loadModule('components/site/navigation.ts', {
      '../../utils/website': website,
    })
    const childrenOnly = ({ children }) => children
    const sharedMocks = {
      'next-i18next': { useTranslation: () => ({ t: (key) => key }) },
      'next/image': () => null,
    }
    const { default: SingleFile } = await loadModule('components/site/SingleFile.tsx', {
      ...sharedMocks,
      '../../public/screenshots/single-file.png': {},
      '../../utils/publicContent': publicContent,
      './Arrow': () => null,
      './Reveal': childrenOnly,
    })
    const { default: FeatureList } = await loadModule('components/FeatureList.tsx', {
      ...sharedMocks,
      '../public/screenshots/ai.png': {},
      '../public/screenshots/sourcecode.png': {},
      '../utils/publicContent': publicContent,
      './site/Arrow': () => null,
      './site/Reveal': childrenOnly,
      './site/HomeMotion': { MotionScene: childrenOnly },
    })
    const markdowns = (await loadPublicMarkdownSources()).map((source) => ({
      ...source, _raw: { flattenedPath: source._id.replace(/\.md$/, '') },
    }))
    const docsPage = await loadModule('pages/docs/[...slug].tsx', {
      'contentlayer/generated': { allMarkdowns: markdowns },
      'next-i18next/serverSideTranslations': { serverSideTranslations: async () => ({}) },
      '../../components/DocsContent': () => null,
      '../../components/DocsLayout': childrenOnly,
      '../../utils/publicContent': publicContent,
      '../../utils/docsTableOfContents': { buildDocsTableOfContents: () => ({ html: '', items: [] }) },
    })
    const { paths } = await docsPage.getStaticPaths({ locales: config.i18n.locales })
    const published = new Set(paths.map(({ locale, params }) =>
      `${locale}:/docs/${params.slug.join('/')}`,
    ))
    const checkedPages = new Set()
    for (const locale of config.i18n.locales) {
      const router = { locale, defaultLocale: 'en', locales: config.i18n.locales,
        pathname: '/', asPath: '/', query: {}, events: { on() {}, off() {} } }
      const render = (Component, props) => renderToStaticMarkup(
        React.createElement(RouterContext.Provider, { value: router },
          React.createElement(Component, props)),
      )
      const assertPublishedLinks = async (html, expectedCount) => {
        const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)]
          .map((match) => match[1]).filter((href) => /^\/(?:en\/|zh\/|ru\/)?docs\//.test(href))
        assert.equal(links.length, expectedCount)
        for (const href of links) {
          const match = href.match(/^\/(?:(en|zh|ru)\/)?(docs\/.*)$/)
          const documentLocale = match[1] || 'en'
          const pathname = `/${match[2]}`
          assert.equal(documentLocale, locale === 'ru' ? 'en' : locale, href)
          const key = `${documentLocale}:${pathname}`
          assert.ok(published.has(key), `No published guide for ${href}`)
          if (!checkedPages.has(key)) {
            const result = await docsPage.getStaticProps({
              locale: documentLocale, params: { slug: pathname.slice('/docs/'.length).split('/') },
            })
            assert.ok(result.props, `Guide returns notFound for ${href}`)
            checkedPages.add(key)
          }
        }
      }
      await assertPublishedLinks(render(SingleFile), 1)
      await assertPublishedLinks(render(FeatureList), 4)
      for (const menu of navigation.siteMenus) {
        const { default: Header } = await loadModule('components/site/Header.tsx', {
          ...sharedMocks,
          // Render each existing menu open without mounting browser-only effects.
          react: { ...React, useState: (value) => React.useState(value === null ? menu.id : value) },
          'motion/react': { AnimatePresence: childrenOnly, motion: { div: childrenOnly },
            useIsPresent: () => true, useReducedMotion: () => true },
          '../../utils/publicContent': publicContent,
          '../../utils/website': website,
          '../Nav/LanguageSwitcher': () => null,
          '../Nav/Logo': { Logo: () => null },
          '../Nav/NavButton': childrenOnly,
          '../ThemeSwitcher': () => null,
          './Arrow': () => null,
          './BrandWordmark': () => null,
          './navigation': navigation,
        })
        const expectedCount = menu.sections.flatMap(({ links }) => links)
          .filter(({ href }) => href.startsWith('/docs/')).length
        await assertPublishedLinks(render(Header, { isMobileNavFolded: true }), expectedCount)
        await assertPublishedLinks(render(Header, { isMobileNavFolded: false }), expectedCount * 2)
      }
    }
    for (const href of ['/docs', '/docs?source=home', '/releases', '/workspace', 'https://example.com/docs/intro']) {
      assert.equal(publicContent.getDocumentLinkLocale(href, 'ru'), 'ru')
    }
  } finally {
    if (previousI18nSupport === undefined) delete process.env.__NEXT_I18N_SUPPORT
    else process.env.__NEXT_I18N_SUPPORT = previousI18nSupport
  }
})
