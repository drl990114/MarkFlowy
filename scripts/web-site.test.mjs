import assert from 'node:assert/strict'
import test from 'node:test'
import { isWebsitePage } from '../apps/web/utils/website.ts'
import { createWaveGeometry } from '../apps/web/components/site/waveGeometry.ts'
import {
  contributorSnapshot,
  loadContributors,
  normalizeContributors,
} from '../apps/web/utils/contributors.ts'

test('contributor profiles exclude bots and malformed or duplicate identities', () => {
  const people = normalizeContributors([
    {
      id: 12,
      login: 'writer',
      avatar_url: 'https://untrusted.example/image',
      html_url: 'javascript:alert(1)',
    },
    { id: 12, login: 'writer' },
    { id: 13, login: 'automation', type: 'Bot' },
    { id: 29791463, login: 'fossabot' },
    { id: -1, login: 'invalid' },
    { id: 14, login: '../elsewhere' },
    null,
  ])
  assert.equal(people.length, 1)
  assert.equal(people[0].html_url, 'https://github.com/writer')
  assert.equal(new URL(people[0].avatar_url).hostname, 'avatars.githubusercontent.com')
})

test('the community survives network failures, rate limits, and invalid GitHub payloads', async () => {
  for (const fetcher of [
    async () => {
      throw new TypeError('Network unavailable')
    },
    async () => new Response('{}', { status: 403 }),
    async () => new Response('{"message":"unavailable"}'),
    async () => new Response('[]'),
  ]) {
    assert.deepEqual(await loadContributors(fetcher), contributorSnapshot)
  }
  const live = await loadContributors(async () => new Response('[{"id":42,"login":"new-writer"}]'))
  assert.equal(live[0].login, 'new-writer')
  assert.equal(live.length, 1)
})

test('public presentation pages use the light website shell, including dynamic docs', () => {
  for (const path of [
    '/',
    '/docs',
    '/docs/[...slug]',
    '/docs/Extension/CustomTheme',
    '/releases',
    '/privacy',
    '/404',
    '/_error',
  ]) {
    assert.equal(isWebsitePage(path), true, path)
  }
})

test('application and machine-readable routes do not receive the marketing page layout', () => {
  for (const path of [
    '/workspace',
    '/workspace/demo-workspace',
    '/workspace/[workspaceId]',
    '/auth/login',
    '/auth/callback',
    '/settings',
    '/settings/profile',
    '/api/health',
    '/docs.md',
    '/docs-api',
    '/llms.txt',
    '/sitemap.xml',
  ]) {
    assert.equal(isWebsitePage(path), false, path)
  }
})

test('the folded wave is a finite indexed surface without broken references', () => {
  const { vertices, indices } = createWaveGeometry()
  const vertexCount = vertices.length / 5
  assert.ok(vertexCount > 10000 && vertexCount <= 65535)
  assert.ok([...vertices].every(Number.isFinite))
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = [...indices.slice(i, i + 3)]
    assert.equal(new Set(triangle).size, 3)
    assert.ok(triangle.every((index) => index < vertexCount))
  }
  for (let i = 0; i < vertices.length; i += 5) {
    assert.ok(vertices[i + 3] >= 0 && vertices[i + 3] <= 1)
    assert.ok(vertices[i + 4] >= 0 && vertices[i + 4] <= 1)
  }
})

test('the two leaves meet around a continuous fold with distinct front and back', () => {
  const { vertices } = createWaveGeometry(128, 4)
  const first = vertices.slice(0, 3)
  const last = vertices.slice(128 * 5, 128 * 5 + 3)
  assert.equal(first[0], last[0])
  assert.equal(first[2], last[2])
  assert.equal(first[1], -last[1])
  assert.ok(first[1] > 0)
  for (let column = 0; column < 128; column++) {
    const a = column * 5
    const distance = Math.hypot(
      ...[0, 1, 2].map((axis) => vertices[a + axis] - vertices[a + 5 + axis]),
    )
    assert.ok(distance < 4, `Discontinuous fold at column ${column}`)
  }
})

test('invalid mesh density cannot wrap WebGL vertex indices', () => {
  for (const [columns, rows] of [
    [0, 192],
    [128, 1.5],
    [512, 512],
  ]) {
    assert.throws(() => createWaveGeometry(columns, rows), RangeError)
  }
})
