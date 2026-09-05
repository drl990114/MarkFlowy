import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { resolvePrivateCapricornRuntime } from './capricornRuntimeResolver'

const temporaryRoots: string[] = []

function createRuntimeFixture(
  options: { importEntry?: string; name?: string; version?: string } = {},
) {
  const packageRoot = mkdtempSync(join(tmpdir(), 'markflowy-capricorn-resolver-'))
  temporaryRoots.push(packageRoot)

  const importEntry = options.importEntry ?? './dist/index.js'
  const runtimeEntry = join(packageRoot, importEntry)
  mkdirSync(join(packageRoot, 'dist'), { recursive: true })
  writeFileSync(runtimeEntry, 'export function createCapricornRuntime() {}')
  const packageJsonPath = join(packageRoot, 'package.json')
  writeFileSync(
    packageJsonPath,
    JSON.stringify({
      name: options.name ?? '@drl990114/capricorn-runtime',
      version: options.version ?? '0.1.17',
      exports: { '.': { import: importEntry } },
    }),
  )

  return { packageJsonPath, runtimeEntry }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe('resolvePrivateCapricornRuntime', () => {
  it('resolves an ESM-only import export from the private package manifest', () => {
    const fixture = createRuntimeFixture()

    expect(resolvePrivateCapricornRuntime(fixture.packageJsonPath)).toBe(fixture.runtimeEntry)
  })

  it('returns null when the private package is not installed', () => {
    const fixture = createRuntimeFixture()
    rmSync(fixture.packageJsonPath)

    expect(resolvePrivateCapricornRuntime(fixture.packageJsonPath)).toBeNull()
  })

  it('returns null for a malformed package manifest', () => {
    const fixture = createRuntimeFixture()
    writeFileSync(fixture.packageJsonPath, '{ invalid JSON')

    expect(resolvePrivateCapricornRuntime(fixture.packageJsonPath)).toBeNull()
  })

  it('rejects a different package name', () => {
    const fixture = createRuntimeFixture({ name: '@other/editor-runtime' })

    expect(resolvePrivateCapricornRuntime(fixture.packageJsonPath)).toBeNull()
  })

  it('returns null when the runtime entry file is missing', () => {
    const fixture = createRuntimeFixture()
    rmSync(fixture.runtimeEntry)

    expect(resolvePrivateCapricornRuntime(fixture.packageJsonPath)).toBeNull()
  })

  it('rejects a runtime entry that is a directory', () => {
    const fixture = createRuntimeFixture()
    rmSync(fixture.runtimeEntry)
    mkdirSync(fixture.runtimeEntry)

    expect(resolvePrivateCapricornRuntime(fixture.packageJsonPath)).toBeNull()
  })

  it.each([
    '0.1.2',
    '0.1.3',
    '0.1.4',
    '0.1.5',
    '0.1.6',
    '0.1.7',
    '0.1.8',
    '0.1.9',
    '0.1.10',
    '0.1.11',
    '0.1.12',
    '0.1.13',
    '0.1.14',
    '0.1.15',
    '0.1.16',
    '0.2.0',
  ])('rejects an unexpected package version %s', (version) => {
    const fixture = createRuntimeFixture({ version })

    expect(resolvePrivateCapricornRuntime(fixture.packageJsonPath)).toBeNull()
  })
})
