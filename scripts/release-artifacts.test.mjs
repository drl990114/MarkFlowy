import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  prepareRelease,
  releaseArtifacts,
  releaseNotes,
  releaseVersion,
  sha256,
} from './release-artifacts.mjs'
import { verifyReleaseAssets } from './verify-release-assets.mjs'

const signature = Buffer.from(
  [
    'untrusted comment: test fixture, not a cryptographic signature',
    Buffer.alloc(74, 1).toString('base64'),
    'trusted comment: fixture',
    Buffer.alloc(64, 2).toString('base64'),
  ].join('\n'),
).toString('base64')

async function fixture(t, version = '1.0.0') {
  const directory = await mkdtemp(path.join(tmpdir(), 'markflowy-release-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  for (const name of releaseArtifacts(version).files) {
    await writeFile(path.join(directory, name), name.endsWith('.sig') ? `${signature}\n` : name)
  }
  return {
    directory,
    tag: `v${version}`,
    repository: 'drl990114/MarkFlowy',
    tauriVersion: version,
    cargoVersion: version,
    notes: 'English changes.\n\n中文更新。',
    publishedAt: '2026-09-27T08:00:00Z',
  }
}

test('release tags must agree with both application version sources', () => {
  assert.deepEqual(releaseVersion('v1.0.0', '1.0.0', '1.0.0'), {
    version: '1.0.0',
    prerelease: false,
  })
  assert.deepEqual(releaseVersion('v1.0.0-rc.1', '1.0.0-rc.1', '1.0.0-rc.1'), {
    version: '1.0.0-rc.1',
    prerelease: true,
  })
  for (const tag of ['1.0.0', 'v01.0.0', 'v1.0', 'v1.0.0-01', 'v../1.0.0']) {
    assert.throws(() => releaseVersion(tag, '1.0.0', '1.0.0'))
  }
  assert.throws(() => releaseVersion('v1.0.0', '0.101.1', '1.0.0'), /does not match/)
  assert.throws(() => releaseVersion('v1.0.0', '1.0.0', '0.101.1'), /does not match/)
})

test('notes come only from the exact tag, with missing notes blocking publication', () => {
  const source =
    '# Log\n\n## v1.0.1\n\nLater\n\n## v1.0.0\n\nEnglish\n### 中文\n更新\n\n## v0.101.1\nOld'
  assert.equal(releaseNotes(source, 'v1.0.0'), 'English\n### 中文\n更新')
  assert.throws(() => releaseNotes(source, 'v1.0.0-rc.1'), /Missing/)
  assert.throws(() => releaseNotes('## v1.0.0\n\n## v0.101.1\nOld', 'v1.0.0'), /Empty/)
})

for (const version of ['1.0.0', '1.0.0-rc.1']) {
  test(`complete ${version} artifacts produce exact-tag updates and checksums`, async (t) => {
    const options = await fixture(t, version)
    const result = await prepareRelease(options)
    assert.equal(result.prerelease, version.includes('-rc.'))
    const manifest = JSON.parse(
      await readFile(path.join(options.directory, 'install.json'), 'utf8'),
    )
    assert.deepEqual(manifest, result.manifest)
    assert.equal(manifest.version, version)
    for (const [platform, file] of Object.entries(releaseArtifacts(version).platforms)) {
      const entry = manifest.platforms[platform]
      assert.equal(
        entry.url,
        `https://github.com/drl990114/MarkFlowy/releases/download/v${version}/${file}`,
      )
      assert.equal(entry.signature, signature)
      assert.doesNotMatch(entry.url, /latest|offline_installer/)
    }
    assert.notEqual(
      manifest.platforms['darwin-aarch64'].url,
      manifest.platforms['darwin-x86_64'].url,
    )
    assert.match(manifest.platforms['windows-x86_64-nsis'].url, /-setup\.exe$/)
    for (const [name, hash] of Object.entries(result.hashes)) {
      assert.equal(hash, await sha256(path.join(options.directory, name)))
    }
    const checksums = await readFile(path.join(options.directory, 'SHA256SUMS'), 'utf8')
    assert.equal(checksums.trim().split('\n').length, releaseArtifacts(version).files.length + 1)
    assert.match(checksums, /  install\.json\n/)
  })
}

test('missing or empty required installers prevent any manifest from being emitted', async (t) => {
  const options = await fixture(t)
  const name = 'MarkFlowy_v1.0.0_offline_installer_x64-setup.exe'
  await rm(path.join(options.directory, name))
  await assert.rejects(prepareRelease(options), /ENOENT/)
  await assert.rejects(readFile(path.join(options.directory, 'install.json')), /ENOENT/)
  await writeFile(path.join(options.directory, name), '')
  await assert.rejects(prepareRelease(options), /empty release artifact/)
})

test('symlink artifacts and missing or invalid signatures fail closed', async (t) => {
  const options = await fixture(t)
  const target = path.join(options.directory, 'MarkFlowy_x64.app.tar.gz.sig')
  await rm(target)
  await assert.rejects(prepareRelease(options), /ENOENT/)
  await symlink('MarkFlowy_aarch64.app.tar.gz.sig', target)
  await assert.rejects(prepareRelease(options), /empty release artifact/)
  await rm(target)
  for (const content of [
    '<html>not found</html>',
    'not a signature',
    Buffer.from('invalid').toString('base64'),
  ]) {
    await writeFile(target, content)
    await assert.rejects(prepareRelease(options), /Invalid Tauri signature/)
  }
  await assert.rejects(readFile(path.join(options.directory, 'install.json')), /ENOENT/)
})

test('uploaded assets must match the full local inventory and hashes before publication', () => {
  const release = { tag_name: 'v1.0.0', draft: true }
  const hashes = { 'install.json': 'a'.repeat(64), SHA256SUMS: 'b'.repeat(64) }
  const assets = Object.entries(hashes).map(([name, hash]) => ({
    name,
    state: 'uploaded',
    digest: `sha256:${hash}`,
  }))
  const options = { release, assets, hashes, tag: 'v1.0.0' }
  assert.doesNotThrow(() => verifyReleaseAssets(options))
  assert.throws(() => verifyReleaseAssets({ ...options, assets: assets.slice(1) }), /missing/)
  assert.throws(
    () => verifyReleaseAssets({ ...options, assets: [...assets, assets[0]] }),
    /missing/,
  )
  assert.throws(
    () => verifyReleaseAssets({ ...options, assets: [...assets, { name: 'stale.zip' }] }),
    /Unexpected/,
  )
  for (const digest of [null, 'sha256:wrong']) {
    assert.throws(
      () => verifyReleaseAssets({ ...options, assets: [{ ...assets[0], digest }, assets[1]] }),
      /SHA-256/,
    )
  }
  assert.throws(
    () => verifyReleaseAssets({ ...options, release: { ...release, draft: false } }),
    /matching draft/,
  )
  assert.throws(() => verifyReleaseAssets({ ...options, tag: 'v1.0.0-rc.1' }), /matching draft/)
})

test('the updater command uses repository versions and exposes the release channel', async (t) => {
  const config = JSON.parse(
    await readFile(new URL('../apps/desktop/src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  )
  const options = await fixture(t, config.version)
  const output = path.join(options.directory, 'github-output')
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      fileURLToPath(new URL('./release-artifacts.mjs', import.meta.url)),
      '--tag',
      options.tag,
      '--repository',
      options.repository,
      '--artifacts',
      options.directory,
    ],
    { cwd: options.directory, env: { ...process.env, GITHUB_OUTPUT: output } },
  )
  assert.match(stdout, /Prepared/)
  assert.match(await readFile(output, 'utf8'), /prerelease=(true|false)/)
  assert.ok((await readFile(path.join(options.directory, 'release-notes.md'), 'utf8')).trim())
  assert.equal(
    JSON.parse(await readFile(path.join(options.directory, 'install.json'), 'utf8')).version,
    config.version,
  )
})
