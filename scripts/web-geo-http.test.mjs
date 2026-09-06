import assert from 'node:assert/strict'
import test from 'node:test'

const baseUrl = process.env.GEO_BASE_URL || 'http://localhost:3100'
const origin = 'https://www.markflowy.cc'
const request = (path, options = {}) =>
  fetch(new URL(path, baseUrl), {
    ...options,
    signal: AbortSignal.timeout(30000),
  })

test('live HTML contains document-specific metadata and text without JavaScript', async () => {
  for (const prefix of ['', '/zh']) {
    for (const slug of [
      'intro',
      'Extension/UseCopilotWithOllama',
      'Performance/large-markdown-files',
    ]) {
      const path = `${prefix}/docs/${slug}`
      const response = await request(path)
      assert.equal(response.status, 200, path)
      const html = await response.text()
      assert.match(html, /<title\b[^>]*>[^<]*MarkFlowy[^<]*<\/title>/)
      assert.ok(html.includes(`rel="canonical" href="${origin}${path}"`), path)
      assert.ok(html.includes(`href="${origin}${path}.md"`), path)
      assert.ok(html.includes(`lang="${prefix ? 'zh' : 'en'}"`), path)
      assert.match(html, /<meta name="description" content="[^"]+"/)
      assert.match(html, /<table>/)
      assert.match(html, /<th>/)
      assert.doesNotMatch(html, /name="robots" content="noindex/)
    }
  }
})

test('every llms document link returns Markdown through the public rewrite', async () => {
  const response = await request('/llms.txt')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /^text\/plain/)
  const index = await response.text()
  const urls = [...index.matchAll(/\]\((https:\/\/www\.markflowy\.cc\/[^)]+\.md)\)/g)].map(
    (match) => match[1],
  )
  assert.ok(urls.length >= 14)
  for (const url of urls) {
    const path = new URL(url).pathname
    const markdown = await request(path)
    assert.equal(markdown.status, 200, path)
    assert.match(markdown.headers.get('content-type'), /^text\/markdown/, path)
    assert.ok(markdown.headers.get('link').includes(`<${url.slice(0, -3)}>; rel="canonical"`), path)
    const body = await markdown.text()
    assert.ok(body.trim().length > 20, path)
    assert.doesNotMatch(body, /^\s*<!doctype html/i, path)
  }
})

test('Markdown routes preserve HEAD and reject unsupported methods and unknown documents', async () => {
  const head = await request('/docs/intro.md', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.match(head.headers.get('content-type'), /^text\/markdown/)
  assert.equal(await head.text(), '')
  const post = await request('/docs/intro.md', { method: 'POST' })
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('allow'), 'GET, HEAD')
  for (const path of [
    '/docs/missing.md',
    '/zh/docs/missing.md',
    '/raw-docs/internal/intro',
  ]) {
    assert.equal((await request(path)).status, 404, path)
  }
})

test('live sitemap contains canonical public HTML pages and bilingual alternates', async () => {
  const response = await request('/sitemap.xml')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /^application\/xml/)
  const xml = await response.text()
  assert.ok(xml.includes(`<loc>${origin}/docs/intro</loc>`))
  assert.ok(xml.includes(`<loc>${origin}/zh/docs/intro</loc>`))
  assert.match(xml, /hreflang="zh-CN"/)
  assert.doesNotMatch(xml, /<loc>[^<]*(?:\/workspace|\/auth|\/settings|\.md<)/)
  const robots = await request('/robots.txt')
  assert.equal(robots.status, 200)
  assert.ok((await robots.text()).includes(`Sitemap: ${origin}/sitemap.xml`))
})

test('application screens stay out of indexing and untranslated privacy URLs redirect', async () => {
  const workspace = await request('/workspace')
  assert.match(await workspace.text(), /name="robots" content="noindex, nofollow"/)
  const privacy = await request('/zh/privacy', { redirect: 'manual' })
  assert.equal(privacy.status, 308)
  assert.equal(new URL(privacy.headers.get('location'), baseUrl).pathname, '/privacy')
})
