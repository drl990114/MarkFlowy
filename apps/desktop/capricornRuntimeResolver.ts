import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'

const CAPRICORN_PACKAGE = '@drl990114/capricorn-runtime'
export const CAPRICORN_VERSION = '0.1.17'

interface CapricornPackageManifest {
  exports?: {
    '.'?:
      | string
      | {
          import?: string
        }
  }
  name?: string
  version?: string
}

export function resolvePrivateCapricornRuntime(packageJsonPath: string): string | null {
  try {
    const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as CapricornPackageManifest

    if (manifest.name !== CAPRICORN_PACKAGE || manifest.version !== CAPRICORN_VERSION) return null

    const rootExport = manifest.exports?.['.']
    const importEntry = typeof rootExport === 'string' ? rootExport : rootExport?.import
    if (!importEntry?.startsWith('./')) return null

    const packageRoot = resolve(dirname(packageJsonPath))
    const runtimeEntry = resolve(packageRoot, importEntry)
    if (!runtimeEntry.startsWith(`${packageRoot}${sep}`) || !statSync(runtimeEntry).isFile()) {
      return null
    }

    return sep === '/' ? runtimeEntry : runtimeEntry.replaceAll(sep, '/')
  } catch {
    return null
  }
}
