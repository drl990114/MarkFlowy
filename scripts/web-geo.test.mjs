import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { allMarkdowns } from '../apps/web/.contentlayer/generated/Markdown/_index.mjs'
import {
  createPublicDocuments,
  getDocumentLocales,
  getLanguageAlternates,
  getPageUrl,
  renderLlmsIndex,
  renderSitemap,
  SITE_ORIGIN,
} from '../apps/web/utils/publicContent.ts'

const documents = createPublicDocuments(allMarkdowns)

test('canonical URLs use the production host, remove tracking, and preserve the selected language', () => {
  assert.equal(
    getPageUrl('/zh/docs/intro/?utm_source=chat#download', 'zh'),
    `${SITE_ORIGIN}/zh/docs/intro`,
  )
  assert.equal(getPageUrl('/en/docs/intro?ref=chat', 'en'), `${SITE_ORIGIN}/docs/intro`)
  assert.equal(getPageUrl('/', 'zh'), `${SITE_ORIGIN}/zh`)
  assert.equal(getPageUrl('/'), `${SITE_ORIGIN}/`)
})

test('language alternates never invent a missing translation', () => {
  const english = documents.find(
    (document) => document.slug === '/intro' && document.locale === 'en',
  )
  assert.deepEqual(getDocumentLocales(english, [english]), ['en'])
  assert.deepEqual(getLanguageAlternates(english.path, ['en']), [
    { hrefLang: 'en', href: english.url },
    { hrefLang: 'x-default', href: english.url },
  ])
  assert.equal(getLanguageAlternates('/docs/intro', ['zh']).length, 1)
})

test('the public document collection excludes unsupported locale directories', () => {
  const source = allMarkdowns[0]
  const result = createPublicDocuments([source, { ...source, locale: 'internal' }])
  assert.equal(result.length, 1)
})

test('all published documents have unique URLs and complete metadata from the current source', async () => {
  assert.ok(documents.length >= 14)
  assert.equal(new Set(documents.map((document) => document.url)).size, documents.length)
  for (const document of documents) {
    assert.ok(document.title.trim())
    assert.ok(document.description.trim())
    assert.ok(document.markdown.trim())
    const source = await readFile(
      new URL(`../docs/${document.locale}${document.slug}.md`, import.meta.url),
      'utf8',
    )
    assert.equal(
      document.markdown.trim(),
      source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim(),
      `Regenerate Contentlayer data for ${document.url}`,
    )
    assert.ok(source.includes(`seoTitle: ${JSON.stringify(document.title)}`))
    assert.ok(source.includes(`description: ${JSON.stringify(document.description)}`))
    if (document.updatedAt) {
      assert.match(document.updatedAt, /^\d{4}-\d{2}-\d{2}$/)
      assert.equal(new Date(document.updatedAt).toISOString().slice(0, 10), document.updatedAt)
    }
  }
})

test('sitemap publishes HTML destinations and only genuine update dates', () => {
  const sitemap = renderSitemap(documents)
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
  for (const document of documents) assert.ok(locations.includes(document.url))
  assert.equal(new Set(locations).size, locations.length)
  assert.ok(locations.includes(`${SITE_ORIGIN}/privacy`))
  assert.ok(!locations.includes(`${SITE_ORIGIN}/zh/privacy`))
  assert.ok(
    locations.every(
      (url) => !/\/(auth|workspace|settings|api)(\/|$)|\.md$/.test(new URL(url).pathname),
    ),
  )
  assert.equal(
    [...sitemap.matchAll(/<lastmod>/g)].length,
    documents.filter((document) => document.updatedAt).length,
  )
  assert.match(sitemap, /xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml"/)
  assert.match(sitemap, /hreflang="zh-CN"/)
})

test('sitemap escapes attribute values and preserves XML validity', () => {
  const source = { ...allMarkdowns[0], slug: '/topic&notes', locale: 'en' }
  const sitemap = renderSitemap(createPublicDocuments([source]))
  assert.match(sitemap, /topic&amp;notes/)
  assert.doesNotMatch(sitemap, /topic&notes/)
})

test('llms index links to the same Markdown documents without embedding a second copy', () => {
  const index = renderLlmsIndex(documents)
  for (const document of documents) {
    assert.ok(index.includes(`](${document.markdownUrl})`))
    assert.ok(index.includes(document.description))
  }
  assert.ok(index.includes('/releases/latest'))
  assert.doesNotMatch(index, /\/workspace|\/auth|\/settings/)
  assert.ok(index.length < 15000)
})

test('relative guide links resolve to published pages in the same language', () => {
  const urls = new Set(documents.map((document) => document.url))
  for (const document of documents.filter((entry) => entry.updatedAt)) {
    for (const [, href] of document.markdown.matchAll(/\]\((\.{1,2}\/[^)]+)\)/g)) {
      assert.ok(urls.has(new URL(href, document.url).href), `${document.url}: ${href}`)
      assert.ok(
        urls.has(new URL(href, document.markdownUrl).href),
        `${document.markdownUrl}: ${href}`,
      )
    }
  }
})

test('public guide comparisons render as HTML tables with real header cells', () => {
  for (const document of allMarkdowns.filter((entry) => entry.updatedAt)) {
    assert.match(document.body.html, /<table>/, document._id)
    assert.match(document.body.html, /<th>/, document._id)
  }
})

test('robots sitemap points at the canonical site', async () => {
  const robots = await readFile(new URL('../apps/web/public/robots.txt', import.meta.url), 'utf8')
  assert.ok(robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`))
  assert.doesNotMatch(robots, /^Disallow: \/$/m)
})
