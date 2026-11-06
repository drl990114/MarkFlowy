// @vitest-environment node

import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import glob from 'fast-glob'
import { createServer, normalizePath, type ConfigEnv, type Plugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { configDefaults } from 'vitest/config'

import * as runtimeResolver from './capricornRuntimeResolver'
import desktopConfig from './vite.config'
import publishedConfig from './vitest.capricorn-published.config'

const desktopRoot = fileURLToPath(new URL('.', import.meta.url))
const sourceRoot = normalizePath(fileURLToPath(new URL('../../packages/zens/src', import.meta.url)))

async function getConfig(command: ConfigEnv['command'], mode: string) {
  return typeof desktopConfig === 'function' ? desktopConfig({ command, mode }) : desktopConfig
}

describe('Desktop workspace development resolution', () => {
  it('assigns every test to exactly one of the unit and published host suites', async () => {
    // A readable entry is sufficient to resolve the config; do not require the
    // private package just to verify test discovery in a public checkout.
    const resolveRuntime = vi
      .spyOn(runtimeResolver, 'resolvePrivateCapricornRuntime')
      .mockReturnValue(fileURLToPath(import.meta.url))
    try {
      const unit = await getConfig('serve', 'test')
      const published = await (typeof publishedConfig === 'function'
        ? publishedConfig({ command: 'serve', mode: 'test' })
        : publishedConfig)
      const allFiles = glob.sync(configDefaults.include, {
        cwd: desktopRoot,
        ignore: configDefaults.exclude,
      })
      const collect = (test: typeof unit.test) =>
        glob.sync(test?.include ?? configDefaults.include, {
          cwd: desktopRoot,
          ignore: test?.exclude ?? configDefaults.exclude,
        })
      const unitFiles = collect(unit.test)
      const publishedFiles = collect(published.test)
      expect(unitFiles.length).toBeGreaterThan(0)
      expect(publishedFiles.length).toBeGreaterThan(0)
      expect(unitFiles.filter((file) => publishedFiles.includes(file))).toEqual([])
      expect([...unitFiles, ...publishedFiles].sort()).toEqual(allFiles.sort())
      expect(publishedFiles).toContain('tests/capricorn-code-settings.integration.test.tsx')
      expect(publishedFiles).toContain(
        'src/components/EditorArea/CapricornEditor.publishedRuntime.test.tsx',
      )
    } finally {
      resolveRuntime.mockRestore()
    }
  })

  it('requires the pinned runtime for the dedicated host suite', async () => {
    const resolveRuntime = vi
      .spyOn(runtimeResolver, 'resolvePrivateCapricornRuntime')
      .mockReturnValue(null)
    try {
      expect((await getConfig('serve', 'test')).test).toBeDefined()
      await expect(
        typeof publishedConfig === 'function'
          ? publishedConfig({ command: 'serve', mode: 'test' })
          : publishedConfig,
      ).rejects.toThrow('Install the pinned Capricorn runtime')
    } finally {
      resolveRuntime.mockRestore()
    }
  })

  it('changes the private runtime URL when its bytes change at the same package path', async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'markflowy-runtime-cache-'))
    const packageRoot = join(fixtureRoot, 'node_modules', 'runtime-cache-fixture')
    mkdirSync(packageRoot, { recursive: true })
    const runtimeEntry = normalizePath(join(packageRoot, 'index.js'))
    const resolveRuntime = vi
      .spyOn(runtimeResolver, 'resolvePrivateCapricornRuntime')
      .mockReturnValue(runtimeEntry)
    const servedModules: string[] = []

    try {
      for (const revision of ['old', 'new']) {
        const source = `export const revision = ${JSON.stringify(revision)};`
        writeFileSync(runtimeEntry, source)
        const expectedHash = createHash('sha256').update(source).digest('hex')
        const config = await getConfig('serve', 'development')
        const runtimePlugin = config.plugins?.find(
          (plugin) => (plugin as Plugin)?.name === 'markflowy-optional-capricorn-runtime',
        ) as Plugin
        const server = await createServer({
          configFile: false,
          root: desktopRoot,
          plugins: [runtimePlugin],
          optimizeDeps: { noDiscovery: true, include: [] },
          server: {
            middlewareMode: true,
            watch: null,
            ws: false,
            fs: { allow: [fixtureRoot] },
          },
        })
        try {
          const result = await server.transformRequest('virtual:markflowy-capricorn-runtime')
          expect(result?.code).toContain(`${runtimeEntry}?v=${expectedHash}`)
          expect(config.define?.__MARKFLOWY_CAPRICORN_RUNTIME_ENTRY_SHA256__).toBe(
            JSON.stringify(expectedHash),
          )
          servedModules.push(result!.code)
        } finally {
          await server.close()
        }
      }
      expect(servedModules[0]).not.toBe(servedModules[1])
    } finally {
      resolveRuntime.mockRestore()
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })

  it.each(['development', 'test'])(
    'resolves shared components, theme context and CSS to source in %s mode',
    async (mode) => {
      const config = await getConfig('serve', mode)
      // Exercise Vite resolution without a listening server, dependency bundling,
      // or relying on generated zens files being present in this checkout.
      const server = await createServer({
        configFile: false,
        root: desktopRoot,
        resolve: config.resolve,
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { middlewareMode: true, watch: null, ws: false },
      })
      try {
        const importer = `${desktopRoot}src/main.tsx`
        const resolve = (id: string, from = importer) =>
          server.environments.client.pluginContainer.resolveId(id, from)

        for (const [id, source] of [
          ['zens', 'index.ts'],
          ['zens/esm/components/button', 'components/button.tsx'],
          ['zens/esm/Theme/components-theme', 'Theme/components-theme.tsx'],
          ['zens/esm/styles.css', 'styles.css'],
        ]) {
          expect((await resolve(id))?.id).toBe(`${sourceRoot}/${source}`)
        }

        // The facade and the package root must share one React context, including
        // when a compiled workspace dependency imports the package root.
        expect(
          await resolve('zens', `${desktopRoot}../../packages/interface/dist/index.mjs`),
        ).toEqual(await resolve('zens'))
        expect(
          await resolve('../Theme/components-theme', `${sourceRoot}/components/button.tsx`),
        ).toEqual(await resolve('zens/esm/Theme/components-theme'))
        expect(config.optimizeDeps?.include).not.toContain('zens')
        expect(config.optimizeDeps?.exclude).toContain('zens')
      } finally {
        await server.close()
      }
    },
  )

  it('keeps production aliases independent of the development source shortcut', async () => {
    const config = await getConfig('build', 'production')
    const aliases = config.resolve?.alias
    expect(Array.isArray(aliases)).toBe(true)
    if (!Array.isArray(aliases)) throw new Error('Expected ordered Desktop aliases')
    for (const alias of aliases) {
      expect(alias.replacement).not.toContain(sourceRoot)
    }
  })
})
