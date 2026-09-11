import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import desktopConfig from './vite.config'

const require = createRequire(import.meta.url)
const defaultRoot = fileURLToPath(new URL('../../../capricorn', import.meta.url))

/** Explicit test-only source integration. Production retains its package/SHA guard. */
export default defineConfig(async (environment) => {
  const sourceRoot = resolve(process.env.CAPRICORN_SOURCE_ROOT || defaultRoot)
  const sourceRequire = createRequire(resolve(sourceRoot, 'package.json'))
  const entry = resolve(sourceRoot, 'src/release/index.tsx')
  if (!existsSync(entry)) throw new Error(`Capricorn source entry not found: ${entry}`)
  const base = await (typeof desktopConfig === 'function'
    ? desktopConfig(environment)
    : desktopConfig)
  return {
    ...base,
    plugins: [
      {
        name: 'capricorn-source-integration',
        enforce: 'pre' as const,
        resolveId(id: string, importer) {
          if (id === 'virtual:markflowy-capricorn-runtime') return entry
          if (/^react(?:-dom)?(?:\/|$)/.test(id)) return require.resolve(id)
          // This CommonJS shim calls require('react'); resolve it beside the host
          // React so its nested Node require shares the same dispatcher as Vite.
          if (/^use-sync-external-store(?:\/|$)/.test(id)) return require.resolve(id)
          if (id === 'lucide-react' && importer?.startsWith(sourceRoot)) {
            const manifest = sourceRequire.resolve('lucide-react/package.json')
            return resolve(dirname(manifest), sourceRequire(manifest).module)
          }
          return null
        },
      },
      ...(base.plugins ?? []).filter(
        (plugin) =>
          !plugin || !('name' in plugin) || plugin.name !== 'markflowy-optional-capricorn-runtime',
      ),
    ],
    define: {
      ...base.define,
      __MARKFLOWY_CAPRICORN_RUNTIME_AVAILABLE__: 'true',
      __MARKFLOWY_CAPRICORN_RUNTIME_VERSION__: JSON.stringify('source-integration'),
    },
    resolve: { ...base.resolve, dedupe: ['react', 'react-dom'] },
    server: {
      fs: {
        allow: [
          sourceRoot,
          dirname(dirname(fileURLToPath(import.meta.url))),
          fileURLToPath(new URL('../..', import.meta.url)),
        ],
      },
    },
    test: {
      ...base.test,
      include: [
        'tests/capricorn-search.integration.tsx',
        'tests/capricorn-links.integration.tsx',
        'tests/capricorn-keybindings.integration.tsx',
      ],
      // Externalized hook libraries resolve React through Node, bypassing Vite's
      // dedupe. Transform both dependency trees so every hook uses the host React.
      server: {
        deps: {
          inline: [/zustand/, /use-sync-external-store/, /@floating-ui\/react/, /lucide-react/],
        },
      },
    },
  }
})
