import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { LazyStore } from '@tauri-apps/plugin-store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LAST_WINDOW_SESSION_KEY,
  readWindowSession,
  windowSessionKey,
  type WindowSession,
} from '@/services/window-session'
import {
  normalizeStartupAppearance,
  persistStartupAppearance,
  readWindowBootstrap,
} from './appearance'

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock, isTauri: () => false }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/i18n', () => ({ i18n: { t: () => 'Untitled' }, t: (key: string) => key }))

const desktopRoot = process.cwd().endsWith('apps/desktop')
  ? process.cwd()
  : resolve(process.cwd(), 'apps/desktop')
const indexHtml = readFileSync(resolve(desktopRoot, 'index.html'), 'utf8')
const bootstrapScript = indexHtml.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1]

const session = (label: string): WindowSession => ({
  version: 1,
  windowLabel: label,
  rootPath: `/${label}`,
  files: [{ id: label, name: 'note.md', path: `/${label}/note.md`, ext: 'md' }],
  editorLayout: { type: 'leaf', id: `${label}-group`, opened: [label], activeId: label },
  activeGroupId: `${label}-group`,
  drafts: { version: 2, documents: [] },
})

const mainSession = session('main')
const childSession = session('main_workspace_a')
const lastActiveSession = session('main_unrelated')

beforeEach(() => {
  invokeMock.mockReset().mockResolvedValue(undefined)
  window.localStorage.clear()
  window.sessionStorage.clear()
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  delete window.__MARKFLOWY_BOOTSTRAP__
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  window.openedUrls = null
  document.documentElement.removeAttribute('data-mf-theme')
  document.documentElement.removeAttribute('style')
})

describe.each([
  { name: 'exact main session', fields: { restoreSessionLabel: 'main' }, expected: mainSession },
  {
    name: 'remapped child session',
    fields: { restoreSessionLabel: 'main_workspace_a' },
    expected: childSession,
  },
  {
    name: 'fresh window after an empty manifest',
    fields: { restoreSessionLabel: null },
    expected: undefined,
  },
  { name: 'legacy launch without a session field', fields: {}, expected: lastActiveSession },
])('window session bootstrap: $name', ({ fields, expected }) => {
  it.each(['HTML', 'initialization', 'persistence', 'complete startup'] as const)(
    'preserves the restore instruction through %s',
    async (stage) => {
      const bootstrap = {
        appearance: normalizeStartupAppearance({ preference: 'light' }, 'light'),
        openedUrls: ['file:///tmp/notes,2026.md'],
        sessionId: 'native-session',
        ...fields,
      }
      window.__MARKFLOWY_BOOTSTRAP__ = bootstrap

      if (stage === 'HTML' || stage === 'complete startup') {
        expect(bootstrapScript).toBeTruthy()
        // Execute the actual pre-module entry, not a copy of its normalization logic.
        window.eval(bootstrapScript!)
      }
      if (stage === 'initialization' || stage === 'complete startup') {
        readWindowBootstrap(window)
      }
      if (stage === 'persistence' || stage === 'complete startup') {
        await persistStartupAppearance(bootstrap.appearance, window)
        expect(invokeMock).toHaveBeenCalledWith('save_startup_appearance', {
          appearance: bootstrap.appearance,
        })
      }

      // Strict equality distinguishes a missing legacy field from an explicit null.
      expect(window.__MARKFLOWY_BOOTSTRAP__).toStrictEqual(bootstrap)

      if (stage === 'complete startup') {
        const data = new Map<string, unknown>([
          [LAST_WINDOW_SESSION_KEY, windowSessionKey(lastActiveSession.windowLabel)],
          ...[mainSession, childSession, lastActiveSession].map(
            (snapshot): [string, unknown] => [windowSessionKey(snapshot.windowLabel), snapshot],
          ),
        ])
        const get = vi.fn(async (key: string) => data.get(key))
        const store: Pick<LazyStore, 'get' | 'set' | 'save'> = {
          get: async <T,>(key: string) => (await get(key)) as T | undefined,
          set: vi.fn(),
          save: vi.fn(),
        }

        expect(
          await readWindowSession(store, 'main', window.__MARKFLOWY_BOOTSTRAP__?.restoreSessionLabel),
        ).toEqual(expected)
        if (!expected) expect(get).not.toHaveBeenCalled()
      }
    },
  )
})
