import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import * as publicContent from '../apps/web/utils/publicContent.ts'

const componentUrl = new URL('../apps/web/components/SeoHead.tsx', import.meta.url)
const require = createRequire(componentUrl)
const { HeadManagerContext } = require('next/dist/shared/lib/head-manager-context.shared-runtime')
const { RouterContext } = require('next/dist/shared/lib/router-context.shared-runtime')
const { outputText } = ts.transpileModule(await readFile(componentUrl, 'utf8'), {
  fileName: componentUrl.pathname,
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
})
const componentModule = { exports: {} }
// Resolve the TypeScript helper without replacing Next's actual Head or router behavior.
new Function('require', 'module', 'exports', outputText)(
  (specifier) => (specifier === '../utils/publicContent' ? publicContent : require(specifier)),
  componentModule,
  componentModule.exports,
)
const SeoHead = componentModule.exports.default

function renderHead({ locale = 'en', pathname = '/', asPath = pathname, ...props } = {}) {
  let elements = []
  const headManager = {
    mountedInstances: new Set(),
    updateHead(nextElements) {
      elements = nextElements
    },
  }
  renderToStaticMarkup(
    React.createElement(
      HeadManagerContext.Provider,
      { value: headManager },
      React.createElement(
        RouterContext.Provider,
        { value: { locale, pathname, asPath } },
        React.createElement(SeoHead, props),
      ),
    ),
  )
  assert.ok(elements.length > 0, 'Next Head must emit server-rendered metadata')
  return {
    elements,
    html: renderToStaticMarkup(React.createElement(React.Fragment, null, ...elements)),
  }
}

function metadata(head, name) {
  const matches = head.elements.filter(
    ({ type, props }) => type === 'meta' && (props.name === name || props.property === name),
  )
  assert.equal(matches.length, 1, `${name} must be present exactly once`)
  return matches[0].props.content
}

function links(head, rel) {
  return head.elements.filter(({ type, props }) => type === 'link' && props.rel === rel)
}

for (const locale of ['en', 'zh']) {
  test(`${locale} pages render localized large social cards with usable image metadata`, async () => {
    const head = renderHead({ locale })
    const imageUrl = `https://www.markflowy.cc/social/markflowy-${locale}.png`
    assert.equal(metadata(head, 'twitter:card'), 'summary_large_image')
    assert.equal(metadata(head, 'twitter:image'), imageUrl)
    assert.equal(metadata(head, 'og:image'), imageUrl)
    assert.equal(metadata(head, 'og:image:type'), 'image/png')
    assert.equal(metadata(head, 'og:image:width'), '1200')
    assert.equal(metadata(head, 'og:image:height'), '630')
    assert.equal(metadata(head, 'og:locale'), locale === 'zh' ? 'zh_CN' : 'en_US')
    assert.equal(metadata(head, 'og:locale:alternate'), locale === 'zh' ? 'en_US' : 'zh_CN')
    assert.equal(metadata(head, 'twitter:image:alt'), metadata(head, 'og:image:alt'))
    assert.match(metadata(head, 'og:image:alt'), locale === 'zh' ? /蓝紫色丝带/ : /ribbons/i)
    assert.equal(metadata(head, 'twitter:description'), metadata(head, 'description'))
    assert.equal(metadata(head, 'og:description'), metadata(head, 'description'))
    assert.match(metadata(head, 'description'), locale === 'zh' ? /本地优先/ : /local-first/)

    const png = await readFile(
      new URL(`../apps/web/public/social/markflowy-${locale}.png`, import.meta.url),
    )
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    assert.equal(png.toString('ascii', 12, 16), 'IHDR')
    assert.equal(png.readUInt32BE(16), Number(metadata(head, 'og:image:width')))
    assert.equal(png.readUInt32BE(20), Number(metadata(head, 'og:image:height')))
    assert.ok(png.length < 1_000_000, 'static social cards stay below 1 MB')
  })
}

test('canonical and social page URLs exclude tracking and fragments for both languages', () => {
  for (const locale of ['en', 'zh']) {
    const head = renderHead({
      locale,
      pathname: '/docs/[...slug]',
      asPath: `/${locale}/docs/intro/?utm_source=twitter#download`,
    })
    const expected = `https://www.markflowy.cc${locale === 'zh' ? '/zh' : ''}/docs/intro`
    assert.deepEqual(
      links(head, 'canonical').map(({ props }) => props.href),
      [expected],
    )
    assert.equal(metadata(head, 'og:url'), expected)
    for (const { props } of links(head, 'alternate')) {
      assert.doesNotMatch(props.href, /[?#]/)
    }
  }
})

test('custom image URLs do not inherit dimensions or MIME types from the default card', () => {
  const head = renderHead({ title: 'Custom page', image: '/images/custom.jpg' })
  assert.equal(metadata(head, 'og:image'), 'https://www.markflowy.cc/images/custom.jpg')
  assert.equal(metadata(head, 'twitter:image'), 'https://www.markflowy.cc/images/custom.jpg')
  assert.equal(metadata(head, 'og:image:alt'), 'Custom page')
  for (const property of ['og:image:width', 'og:image:height', 'og:image:type']) {
    assert.ok(!head.elements.some(({ props }) => props.property === property), property)
  }
})

test('custom image objects preserve their own metadata in Open Graph and X cards', () => {
  const head = renderHead({
    image: {
      url: 'https://images.example.com/document.webp',
      alt: 'Markdown editing in the document view',
      width: 1600,
      height: 900,
      type: 'image/webp',
    },
  })
  assert.equal(metadata(head, 'og:image'), 'https://images.example.com/document.webp')
  assert.equal(metadata(head, 'twitter:image'), 'https://images.example.com/document.webp')
  assert.equal(metadata(head, 'og:image:width'), '1600')
  assert.equal(metadata(head, 'og:image:height'), '900')
  assert.equal(metadata(head, 'og:image:type'), 'image/webp')
  assert.equal(metadata(head, 'og:image:alt'), 'Markdown editing in the document view')
  assert.equal(metadata(head, 'twitter:image:alt'), 'Markdown editing in the document view')
})

test('the English privacy page advertises only translations that exist', () => {
  const head = renderHead({ pathname: '/privacy', availableLocales: ['en'] })
  assert.deepEqual(
    links(head, 'alternate').map(({ props }) => ({ hrefLang: props.hrefLang, href: props.href })),
    [
      { hrefLang: 'en', href: 'https://www.markflowy.cc/privacy' },
      { hrefLang: 'x-default', href: 'https://www.markflowy.cc/privacy' },
    ],
  )
  assert.ok(!head.elements.some(({ props }) => props.property === 'og:locale:alternate'))
})

test('documentation retains its title and Markdown discovery without homepage structured data', () => {
  const title = 'Custom themes | MarkFlowy'
  const head = renderHead({
    pathname: '/docs/[...slug]',
    asPath: '/docs/Extension/CustomTheme',
    title,
    description: 'Create and share a custom editor theme.',
    markdownUrl: 'https://www.markflowy.cc/docs/Extension/CustomTheme.md',
  })
  assert.deepEqual(
    head.elements.filter(({ type }) => type === 'title').map(({ props }) => props.children),
    [title],
  )
  assert.equal(metadata(head, 'og:title'), title)
  assert.equal(metadata(head, 'twitter:title'), title)
  assert.equal(metadata(head, 'description'), 'Create and share a custom editor theme.')
  assert.ok(
    links(head, 'alternate').some(
      ({ props }) =>
        props.type === 'text/markdown' &&
        props.href === 'https://www.markflowy.cc/docs/Extension/CustomTheme.md',
    ),
  )
  assert.ok(
    !head.elements.some(
      ({ type, props }) => type === 'script' && props.type === 'application/ld+json',
    ),
  )
})

test('homepage structured data has stable brand URLs and escapes embedded closing script tags', () => {
  const description = 'Writer </script><script>alert("unsafe")</script> & notes'
  for (const locale of ['en', 'zh']) {
    const head = renderHead({ locale, description })
    const scripts = head.elements.filter(
      ({ type, props }) => type === 'script' && props.type === 'application/ld+json',
    )
    assert.equal(scripts.length, 1)
    const serialized = scripts[0].props.dangerouslySetInnerHTML.__html
    assert.doesNotMatch(serialized, /</)
    assert.equal([...head.html.matchAll(/<script\b/g)].length, 1)
    assert.equal([...head.html.matchAll(/<\/script>/g)].length, 1)
    const data = JSON.parse(serialized)
    assert.equal(data['@context'], 'https://schema.org')
    const website = data['@graph'].find((entry) => entry['@type'] === 'WebSite')
    const application = data['@graph'].find((entry) => entry['@type'] === 'SoftwareApplication')
    assert.equal(website.name, 'MarkFlowy')
    assert.equal(website.url, 'https://www.markflowy.cc/')
    assert.equal(website['@id'], 'https://www.markflowy.cc/#website')
    assert.equal(application['@id'], 'https://www.markflowy.cc/#application')
    assert.equal(application.url, `https://www.markflowy.cc${locale === 'zh' ? '/zh' : '/'}`)
    assert.equal(application.image, `https://www.markflowy.cc/social/markflowy-${locale}.png`)
    assert.equal(application.description, description)
    assert.equal(application.downloadUrl, 'https://github.com/drl990114/MarkFlowy/releases')
    assert.deepEqual(application.sameAs, ['https://github.com/drl990114/MarkFlowy'])
    assert.equal(application.operatingSystem, 'macOS, Windows, Linux')
  }
})
