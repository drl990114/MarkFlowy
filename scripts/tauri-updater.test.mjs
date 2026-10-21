import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const releaseUrl = 'https://example.test/releases/download/v1.2.0/'
const packages = {
  appimage: 'MarkFlowy_v1.2.0_amd64.AppImage',
  deb: 'MarkFlowy_v1.2.0_amd64.deb',
  rpm: 'MarkFlowy-1.2.0-1.x86_64.rpm',
  macIntel: 'MarkFlowy_x64.app.tar.gz',
  macArm: 'MarkFlowy_aarch64.app.tar.gz',
  windows: 'MarkFlowy_v1.2.0_x64.msi',
  nsis: 'MarkFlowy_v1.2.0_x64-setup.exe',
}
const asset = (name) => ({ name, browser_download_url: releaseUrl + name })
const ignoredPackages = [
  'MarkFlowy_v1.2.0_offline_installer_x64.msi',
  'MarkFlowy_v1.2.0_offline_installer_x64-setup.exe',
  'MarkFlowy_v1.2.0_x64.dmg',
  'MarkFlowy_v1.2.0_aarch64.dmg',
  'MarkFlowy_v1.2.0_x64_portable.zip',
]
const assets = [
  ...Object.values(packages).flatMap((name) => [asset(name), asset(`${name}.sig`)]),
  ...ignoredPackages.map(asset),
  ...ignoredPackages.slice(0, 2).map((name) => asset(`${name}.sig`)),
]
const targets = {
  linux: packages.appimage,
  'linux-x86_64': packages.appimage,
  'linux-x86_64-appimage': packages.appimage,
  'linux-x86_64-deb': packages.deb,
  'linux-x86_64-rpm': packages.rpm,
  darwin: packages.macIntel,
  'darwin-x86_64': packages.macIntel,
  'darwin-aarch64': packages.macArm,
  win64: packages.windows,
  'windows-x86_64': packages.windows,
  'windows-x86_64-msi': packages.windows,
  'windows-x86_64-nsis': packages.nsis,
}
const signature = (name) => Buffer.from(`signature for ${name}`).toString('base64')

// Run the installed postinstall-patched modules, mocking only external IO.
// Both distributed entry points must generate the same manifest.
async function updaterHarness(format, releaseAssets = assets, fetchSignature) {
  const source = await readFile(
    new URL(`../node_modules/@tauri-release/cli/dist/updater.${format}`, import.meta.url),
    'utf8',
  )
  const writes = []
  const downloads = []
  const fs = {
    existsSync: () => true,
    writeFileSync: (filename, content) => writes.push({ filename, data: JSON.parse(content) }),
  }
  const github = {
    context: { repo: { owner: 'fixture', repo: 'MarkFlowy' } },
    getOctokit: () => ({
      rest: {
        repos: {
          listTags: async () => ({ data: [{ name: 'v1.2.0' }] }),
          getReleaseByTag: async () => ({ data: { assets: releaseAssets } }),
        },
      },
    }),
  }
  const utils = {
    $argv: () => ({ token: 'fixture-token' }),
    $: Object.fromEntries(['red', 'green', 'yellow', 'blue', 'gray'].map((key) => [key, String])),
    UPDATER_JSON_PATH: '/fixture/install.json',
    ROOT_PATH: '/fixture',
    relativePath: (value) => value,
  }
  const fetch = async (url) => {
    assert.ok(url.endsWith('.sig'), `Unexpected download: ${url}`)
    downloads.push(url)
    return (
      (await fetchSignature?.(url)) ?? {
        ok: true,
        text: async () => signature(url.slice(releaseUrl.length, -4)),
      }
    )
  }
  const updatelog = () => ({ content: 'Release notes' })
  const dependencies = {
    fs,
    path,
    'node-fetch': fetch,
    '@actions/github': github,
    './shared/cli.de4d4f3c.cjs': utils,
    './updatelog.cjs': updatelog,
    module: {},
  }
  const context = {
    fs,
    path,
    fetch,
    ...github,
    ...utils,
    updatelog,
    console: { log() {} },
    module: { exports: {} },
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
      return dependencies[name]
    },
  }
  // ESM imports/exports are replaced only to inject the same IO mocks as CJS.
  const script =
    format === 'mjs'
      ? source
          .replace(/^import .+;\r?\n/gm, '')
          .replace('export { updater as default };', 'updater')
      : `${source}\nmodule.exports`
  return { run: runInNewContext(script, context), writes, downloads }
}

for (const format of ['mjs', 'cjs']) {
  test(`${format}: all update targets retain their own packages and signatures`, async () => {
    for (const orderedAssets of [assets, [...assets].reverse()]) {
      const { run, writes, downloads } = await updaterHarness(format, orderedAssets)
      await run()
      assert.equal(writes.length, 1)
      const manifest = writes[0].data
      assert.equal(manifest.version, 'v1.2.0')
      assert.equal(manifest.notes, 'Release notes')
      for (const [target, name] of Object.entries(targets)) {
        assert.deepEqual(
          manifest.platforms[target],
          {
            url: releaseUrl + name,
            signature: signature(name),
          },
          target,
        )
      }
      assert.deepEqual(Object.keys(manifest.platforms).sort(), Object.keys(targets).sort())
      assert.deepEqual(
        downloads.sort(),
        Object.values(packages)
          .map((name) => releaseUrl + name + '.sig')
          .sort(),
        'Only selected updater signatures should be downloaded, exactly once each',
      )
    }
  })

  test(`${format}: unrelated architectures and sidecar files cannot replace update assets`, async () => {
    const unrelated = [
      'MarkFlowy_v1.2.0_arm64.msi',
      'MarkFlowy_v1.2.0_arm64-setup.exe',
      'MarkFlowy_v1.2.0_i686.msi',
      'MarkFlowy_v1.2.0_arm64.deb',
      'MarkFlowy_v1.2.0_arm64.AppImage',
      'MarkFlowy-1.2.0-1.aarch64.rpm',
      'MarkFlowy_universal.app.tar.gz',
      ...Object.values(packages).map((name) => `${name}.sha256`),
    ].flatMap((name) => [asset(name), asset(`${name}.sig`)])
    const { run, writes } = await updaterHarness(format, [...assets, ...unrelated])
    await run()
    for (const [target, name] of Object.entries(targets)) {
      assert.equal(writes[0].data.platforms[target].url, releaseUrl + name, target)
      assert.equal(writes[0].data.platforms[target].signature, signature(name), target)
    }
  })

  test(`${format}: ARM signature is fetched once and cannot overwrite the archive URL on retry`, async () => {
    let requests = 0
    const { run, writes } = await updaterHarness(format, assets, async (url) => {
      if (url !== releaseUrl + packages.macArm + '.sig') return
      requests += 1
      return { ok: requests === 1, text: async () => signature(packages.macArm) }
    })
    await run()
    assert.equal(requests, 1)
    assert.equal(writes[0].data.platforms['darwin-aarch64'].url, releaseUrl + packages.macArm)
    assert.equal(writes[0].data.platforms['darwin-aarch64'].signature, signature(packages.macArm))
  })

  for (const type of Object.keys(packages)) {
    for (const suffix of ['', '.sig']) {
      test(`${format}: missing ${type}${suffix} prevents manifest publication`, async () => {
        const incomplete = assets.filter(({ name }) => name !== packages[type] + suffix)
        const { run, writes } = await updaterHarness(format, incomplete)
        await assert.rejects(run, /Missing updater asset or signature/)
        assert.deepEqual(writes, [])
      })
    }

    for (const failure of ['http', 'empty', 'whitespace', 'network', 'body']) {
      test(`${format}: ${failure} failure fetching ${type} signature prevents publication`, async () => {
        const { run, writes } = await updaterHarness(format, assets, async (url) => {
          if (url !== releaseUrl + packages[type] + '.sig') return
          if (failure === 'network') throw new Error('Connection reset')
          return {
            ok: failure !== 'http',
            text: async () => {
              if (failure === 'body') throw new Error('Response interrupted')
              return failure === 'http' ? 'Not Found' : failure === 'whitespace' ? ' \n' : ''
            },
          }
        })
        await assert.rejects(run)
        assert.deepEqual(writes, [])
      })
    }
  }
}
