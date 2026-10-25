import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileResultCode } from '@markflowy/interface'
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { BaseDirectory } from '@tauri-apps/api/path'
import { LazyStore } from '@tauri-apps/plugin-store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as UpdateRecovery from './update-recovery'

const STORE_PATH = '.markflowy_updater.dat'
const attempt = { fromVersion: '1.2.0', targetVersion: '1.2.1', startedAt: 1 }

let directory: string
let filePath: string
let recovery: typeof UpdateRecovery
let cache: Record<string, unknown>
let loaded: boolean
let saveError: Error | undefined

const readStore = async () => {
  const value: unknown = JSON.parse(await readFile(filePath, 'utf8'))
  // Native Store deserializes to a HashMap, so arrays and null are not stores.
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object')
  }
  return value
}

// Keep the installed JS LazyStore/Store implementation; only replace IPC.
// Model plugin-store 2.5.0's swallowed initial load and strict, merging reload.
const ipc = vi.fn(async (command: string, args?: unknown): Promise<unknown> => {
  const payload = args as {
    path: string
    key: string
    value: unknown
    ignoreDefaults?: boolean
    directory: BaseDirectory
    paths: string[]
    filePath: string
  }
  switch (command) {
    case 'plugin:store|load':
      expect(payload.path).toBe(STORE_PATH)
      if (!loaded) {
        loaded = true
        try {
          Object.assign(cache, await readStore())
        } catch {
          // The native initial load ignores both I/O and JSON errors.
        }
      }
      return 1
    case 'plugin:store|reload': {
      const values = await readStore()
      cache = Object.assign(payload.ignoreDefaults ? {} : cache, values)
      return
    }
    case 'plugin:store|get':
      return [cache[payload.key], Object.hasOwn(cache, payload.key)]
    case 'plugin:store|set':
      cache[payload.key] = payload.value
      return
    case 'plugin:store|save':
      if (saveError) throw saveError
      await writeFile(filePath, JSON.stringify(cache))
      return
    case 'plugin:path|resolve_directory':
      expect(payload.directory).toBe(BaseDirectory.AppData)
      return directory
    case 'plugin:path|join':
      return join(...payload.paths)
    case 'get_file_content':
      expect(payload.filePath).toBe(filePath)
      try {
        return { code: FileResultCode.Success, content: await readFile(filePath, 'utf8') }
      } catch (error) {
        const code =
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? FileResultCode.NotFound
            : FileResultCode.UnknownError
        return { code, content: String(error) }
      }
    case 'plugin:app|version':
      return attempt.fromVersion
    default:
      throw new Error(`Unexpected IPC command: ${command}`)
  }
})

beforeEach(async () => {
  vi.resetModules()
  ipc.mockClear()
  directory = await mkdtemp(join(tmpdir(), 'markflowy-update-recovery-'))
  filePath = join(directory, STORE_PATH)
  cache = {}
  loaded = false
  saveError = undefined
  mockIPC(ipc)
  recovery = await import('./update-recovery')
})

afterEach(async () => {
  clearMocks()
  await rm(directory, { recursive: true, force: true })
})

describe('update recovery with the installed LazyStore', () => {
  it.each([
    ['empty', ''],
    ['truncated', '{"pending_install":'],
    ['array', '[]'],
    ['null', 'null'],
  ])(
    'rejects a %s store even though its initial load silently returns no marker',
    async (_, contents) => {
      await writeFile(filePath, contents)
      const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: false })
      await expect(store.get('pending_install')).resolves.toBeUndefined()

      await expect(recovery.getInterruptedUpdate()).rejects.toThrow()
      await expect(recovery.getInterruptedUpdate()).rejects.toThrow()

      expect(await readFile(filePath, 'utf8')).toBe(contents)
      expect(ipc.mock.calls.some(([command]) => command === 'plugin:store|save')).toBe(false)
    },
  )

  it('allows a genuinely missing file without creating it', async () => {
    await expect(recovery.getInterruptedUpdate()).resolves.toBeNull()

    expect(ipc).toHaveBeenCalledWith('get_file_content', { filePath })
    await expect(readFile(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('recovers a valid marker, then rejects damage introduced after the store was loaded', async () => {
    await writeFile(filePath, JSON.stringify({ pending_install: attempt }))
    await expect(recovery.getInterruptedUpdate()).resolves.toEqual(attempt)
    expect(ipc.mock.calls.some(([command]) => command === 'get_file_content')).toBe(false)

    await writeFile(filePath, '{')
    await expect(recovery.getInterruptedUpdate()).rejects.toThrow()
    expect(await readFile(filePath, 'utf8')).toBe('{')
  })

  it.each([false, true])('retains an unsaved marker when the file exists: %s', async (exists) => {
    if (exists) await writeFile(filePath, '{}')
    saveError = new Error('disk full')
    await expect(
      recovery.recordUpdateAttempt({
        currentVersion: attempt.fromVersion,
        version: attempt.targetVersion,
      }),
    ).rejects.toThrow('disk full')

    await expect(recovery.getInterruptedUpdate()).resolves.toMatchObject({
      fromVersion: attempt.fromVersion,
      targetVersion: attempt.targetVersion,
    })
    if (exists) expect(await readFile(filePath, 'utf8')).toBe('{}')
    else await expect(readFile(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
