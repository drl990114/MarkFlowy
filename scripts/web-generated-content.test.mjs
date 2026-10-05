import assert from 'node:assert/strict'
import test from 'node:test'
import { allMarkdowns } from '../apps/web/.contentlayer/generated/Markdown/_index.mjs'
import { loadPublicMarkdownSources } from './web-document-sources.mjs'

const sources = await loadPublicMarkdownSources()
const generated = allMarkdowns.filter((document) => ['en', 'zh'].includes(document.locale))

test('generated public documents include every current source and no deleted pages', () => {
  assert.deepEqual(
    generated.map((document) => document._id).sort(),
    sources.map((document) => document._id).sort(),
    'Regenerate Contentlayer data: the published document set differs from docs/',
  )
})

test('generated document metadata and Markdown match the parsed source', () => {
  const generatedById = new Map(generated.map((document) => [document._id, document]))
  for (const source of sources) {
    const document = generatedById.get(source._id)
    assert.ok(document, source._id)
    for (const key of ['slug', 'locale', 'seoTitle', 'description', 'updatedAt']) {
      assert.equal(document[key], source[key], `${source._id}: stale ${key}`)
    }
    assert.equal(document.body.raw.trim(), source.body.raw.trim(), `${source._id}: stale body`)
  }
})

test('public guide comparisons render as HTML tables with real header cells', () => {
  const tableDocuments = generated.filter((entry) => /^\|[ \t]*:?-{3,}/m.test(entry.body.raw))
  assert.ok(tableDocuments.length > 0, 'The public guides must include comparison tables')
  for (const document of tableDocuments) {
    assert.match(document.body.html, /<table>/, document._id)
    assert.match(document.body.html, /<th>/, document._id)
  }
})
