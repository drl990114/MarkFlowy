import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createRef, StrictMode } from 'react'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CapricornEditor, type CapricornEditorHandle } from './CapricornEditor'
import type * as RuntimeAdapter from './capricornRuntimeAdapter'
import {
  loadCapricornRuntimeFactory,
  type CapricornRuntimeFactory,
} from './capricornRuntimeAdapter'

// Opt in to a local source checkout for cross-repository unit tests. Production
// resolution and the pinned private package always keep their normal boundary.
const sourceRoot = process.env.MARKFLOWY_CAPRICORN_SOURCE_ROOT
vi.mock('./capricornRuntimeAdapter', async (importOriginal) => ({
  ...(await importOriginal<typeof RuntimeAdapter>()),
  getLoadedCapricornRuntimeFactory: () => undefined,
  loadCapricornRuntimeFactory: vi.fn(),
}))
let server: ViteDevServer | undefined
beforeAll(async () => {
  if (!sourceRoot) return
  const require = createRequire(import.meta.url)
  server = await createServer({
    configFile: false,
    root: sourceRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
    plugins: [
      {
        name: 'share-host-react-in-source-runtime-tests',
        enforce: 'pre',
        resolveId(id) {
          if (/^react(?:-dom)?(?:\/|$)/.test(id)) return { id: require.resolve(id), external: true }
        },
      },
    ],
    resolve: {
      alias: [
        {
          find: /^decode-named-character-reference$/,
          replacement: createRequire(resolve(sourceRoot, 'package.json')).resolve(
            'decode-named-character-reference',
          ),
        },
      ],
    },
  })
  const runtime = await server.ssrLoadModule('/src/release/index.tsx')
  vi.mocked(loadCapricornRuntimeFactory).mockResolvedValue(
    runtime.createCapricornRuntime as CapricornRuntimeFactory,
  )
}, 30_000)
afterEach(async () => {
  await act(async () => cleanup())
})
afterAll(async () => server?.close())

describe.skipIf(!sourceRoot)('CapricornEditor with local source runtime', () => {
  it.each([false, true])(
    'applies placeholder settings without remounting or dirty changes (strict=%s)',
    async (strict) => {
      const ref = createRef<CapricornEditorHandle>()
      const onChange = vi.fn()
      const onEditorChange = vi.fn()
      const onError = vi.fn()
      const onUnavailable = vi.fn()
      const element = (enabled: boolean, text = '输入 / 使用命令') => {
        const editor = (
          <CapricornEditor
            ref={ref}
            active
            initialMarkdown=''
            onChange={onChange}
            onEditorChange={onEditorChange}
            onError={onError}
            onUnavailable={onUnavailable}
            options={{ placeholder: { enabled, placeholder: text }, virtualize: { enable: false } }}
          />
        )
        return strict ? <StrictMode>{editor}</StrictMode> : editor
      }
      const { container, rerender, unmount } = render(element(false))
      await waitFor(() =>
        expect(onEditorChange.mock.calls.filter(([adapter]) => adapter !== null)).toHaveLength(1),
      )
      const root = container.querySelector('[data-cap-content]')
      expect(root).not.toBeNull()
      expect(container.querySelector('[data-cap-placeholder]')).toBeNull()
      await act(async () => rerender(element(true)))
      await waitFor(() =>
        expect(
          container.querySelector('[data-cap-placeholder]')?.getAttribute('data-placeholder'),
        ).toBe('输入 / 使用命令'),
      )
      await act(async () => rerender(element(true, 'Updated hint')))
      await waitFor(() =>
        expect(
          container.querySelector('[data-cap-placeholder]')?.getAttribute('data-placeholder'),
        ).toBe('Updated hint'),
      )
      await act(async () => rerender(element(false)))
      await waitFor(() => expect(container.querySelector('[data-cap-placeholder]')).toBeNull())
      expect(container.querySelector('[data-cap-content]')).toBe(root)
      expect(ref.current?.getMarkdown()).toBe('')
      expect(onEditorChange.mock.calls.filter(([adapter]) => adapter !== null)).toHaveLength(1)
      expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
      expect(onError).not.toHaveBeenCalled()
      expect(onUnavailable).not.toHaveBeenCalled()
      await act(async () => unmount())
      expect(onEditorChange).toHaveBeenLastCalledWith(null)
    },
  )
})
