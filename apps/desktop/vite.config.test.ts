// @vitest-environment node

import { fileURLToPath } from 'node:url'
import { createServer, normalizePath, type ConfigEnv } from 'vite'
import { describe, expect, it } from 'vitest'

import desktopConfig from './vite.config'

const desktopRoot = fileURLToPath(new URL('.', import.meta.url))
const sourceRoot = normalizePath(fileURLToPath(new URL('../../packages/zens/src', import.meta.url)))

async function getConfig(command: ConfigEnv['command'], mode: string) {
  return typeof desktopConfig === 'function' ? desktopConfig({ command, mode }) : desktopConfig
}

describe('Desktop workspace development resolution', () => {
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
