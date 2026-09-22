import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { homeScrollResetScript } from '../apps/web/utils/homeScroll.ts'
import { isWebsitePage } from '../apps/web/utils/website.ts'
import { createWaveGeometry } from '../apps/web/components/site/waveGeometry.ts'
import { loadProjectStats, projectStatsSnapshot } from '../apps/web/utils/projectStats.ts'
import { formatProjectCount } from '../apps/web/utils/formatProjectCount.ts'
import {
  contributorSnapshot,
  loadContributors,
  normalizeContributors,
} from '../apps/web/utils/contributors.ts'

const release = (assets) => ({ draft: false, prerelease: false, assets })
const repositoryStats = { stargazers_count: 2400, forks_count: 100 }
const asset = (name, download_count) => ({ name, download_count })

function initializeHomeScroll(type, hash = '#features') {
  const events = new EventTarget()
  const frames = []
  const scrolls = []
  const location = new URL(`https://markflowy.cc/zh?ref=homepage${hash}`)
  const state = { key: 'existing-history-entry' }
  const history = {
    state,
    scrollRestoration: 'auto',
    replaceState(nextState, _title, url) {
      this.state = nextState
      location.href = new URL(url, location).href
    },
  }
  runInNewContext(homeScrollResetScript, {
    performance: { getEntriesByType: () => (type ? [{ type }] : []) },
    history,
    location,
    window: {
      addEventListener: events.addEventListener.bind(events),
      scrollTo: (options) => scrolls.push({ ...options }),
    },
    requestAnimationFrame: (callback) => frames.push(callback),
  })
  return { events, frames, history, location, scrolls, state }
}

test('homepage reload starts at the top and removes only the stale fragment', () => {
  const page = initializeHomeScroll('reload')
  assert.equal(page.location.href, 'https://markflowy.cc/zh?ref=homepage')
  assert.equal(page.history.state, page.state)
  assert.equal(page.history.scrollRestoration, 'manual')
  assert.deepEqual(page.scrolls, [{ top: 0, left: 0, behavior: 'instant' }])

  page.events.dispatchEvent(new Event('pageshow'))
  assert.equal(page.history.scrollRestoration, 'manual')
  page.frames.shift()()
  assert.equal(page.history.scrollRestoration, 'auto')
  page.events.dispatchEvent(new Event('pageshow'))
  assert.equal(page.frames.length, 0)
  assert.equal(page.scrolls.length, 1)
})

test('homepage reload also resets a saved scroll position without a fragment', () => {
  const page = initializeHomeScroll('reload', '')
  assert.equal(page.history.scrollRestoration, 'manual')
  assert.deepEqual(page.scrolls, [{ top: 0, left: 0, behavior: 'instant' }])
})

test('fresh deep links and back/forward visits retain native scrolling', () => {
  for (const type of ['navigate', 'back_forward', undefined]) {
    const page = initializeHomeScroll(type)
    assert.equal(page.location.hash, '#features')
    assert.equal(page.history.scrollRestoration, 'auto')
    assert.deepEqual(page.scrolls, [])
    page.events.dispatchEvent(new Event('pageshow'))
    assert.equal(page.frames.length, 0)
  }
})

test('homepage counts use compact lower-bound milestones across locales', () => {
  assert.equal(formatProjectCount(2393, 'zh'), '2.3k+')
  assert.equal(formatProjectCount(93, 'zh'), '90+')
  assert.equal(formatProjectCount(28848, 'zh'), '2.8万+')
  assert.equal(formatProjectCount(28848, 'en'), '28k+')
  assert.equal(formatProjectCount(28848, 'ja'), '2.8万+')
  assert.equal(formatProjectCount(9999, 'en'), '9.9k+')
  assert.equal(formatProjectCount(10000, 'zh'), '1万+')
  assert.equal(formatProjectCount(0, 'en'), '0')
  assert.equal(formatProjectCount(7, 'zh'), '7')
})

test('project statistics count stable packages, excluding signatures and update metadata', async () => {
  const releases = [
    release([
      asset('MarkFlowy.dmg', 10),
      asset('MarkFlowy.AppImage', 20),
      asset('MarkFlowy.app.tar.gz', 30),
      asset('MarkFlowy.msi', 40),
      asset('MarkFlowy.exe', 50),
      asset('MarkFlowy.deb', 60),
      asset('MarkFlowy.rpm', 70),
      asset('MarkFlowy_portable.zip', 80),
      asset('MarkFlowy.exe.sig', 1000),
      asset('install.json', 2000),
      asset('checksums.txt', 3000),
    ]),
    { ...release([asset('preview.dmg', 500)]), prerelease: true },
    { ...release([asset('draft.dmg', 600)]), draft: true },
  ]
  const result = await loadProjectStats(async (url) =>
    Response.json(url.includes('/releases?') ? releases : repositoryStats),
  )
  assert.equal(result.downloads, 360)
  assert.equal(result.stars, 2400)
  assert.equal(result.forks, 100)
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)))
})

test('project download totals include every release page, including a full final page', async () => {
  const pages = []
  const result = await loadProjectStats(async (url) => {
    if (!url.includes('/releases?')) return Response.json(repositoryStats)
    const page = new URL(url).searchParams.get('page')
    pages.push(page)
    return Response.json(
      page === '3' ? [] : Array.from({ length: 100 }, () => release([asset('app.dmg', 2)])),
    )
  })
  assert.deepEqual(pages, ['1', '2', '3'])
  assert.equal(result.downloads, 400)
})

test('unavailable or malformed project data uses the dated snapshot instead of partial totals', async () => {
  for (const fetcher of [
    async () => {
      throw new TypeError('Network unavailable')
    },
    async () => new Response('{}', { status: 403 }),
    async () => Response.json({ message: 'Unexpected response' }),
    async (url) =>
      Response.json(
        url.includes('/releases?') ? [release([asset('app.dmg', -1)])] : repositoryStats,
      ),
    async (url) =>
      Response.json(url.includes('/releases?') ? [] : { ...repositoryStats, forks_count: '100' }),
    async (url) => {
      if (!url.includes('/releases?')) return Response.json(repositoryStats)
      if (url.includes('page=2')) return new Response('{}', { status: 503 })
      return Response.json(Array.from({ length: 100 }, () => release([asset('app.dmg', 2)])))
    },
  ]) {
    assert.deepEqual(await loadProjectStats(fetcher), projectStatsSnapshot)
  }
})

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

test('public presentation pages use the website shell, including dynamic docs', () => {
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
