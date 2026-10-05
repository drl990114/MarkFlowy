import assert from 'node:assert/strict'
import test from 'node:test'
import { getReleases } from '../apps/web/utils/githubApi.ts'

test('a transient GitHub failure can recover and only successful release lists are cached', async (t) => {
  let attempts = 0
  const releases = [{ id: 1, tag_name: 'v1.0.0', body: 'A release.' }]
  t.mock.method(globalThis, 'fetch', async () => {
    attempts += 1
    return attempts === 1
      ? Response.json({ message: 'Temporary failure' }, { status: 503 })
      : Response.json(releases)
  })
  await assert.rejects(getReleases('website-release-recovery'), /503/)
  assert.deepEqual(await getReleases('website-release-recovery'), releases)
  assert.deepEqual(await getReleases('website-release-recovery'), releases)
  assert.equal(attempts, 2)
})

test('an invalid API payload is rejected instead of cached as release data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'not a release list' }))
  await assert.rejects(getReleases('website-release-invalid'), /not a list/)
})
