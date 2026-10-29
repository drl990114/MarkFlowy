import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import {
  createCapricornRuntimeAdapter,
  type CapricornInlineEditRequest,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { normalizeInlineAddress } from '@/components/EditorArea/inlineInsert'
import { getImageUrlInTauri } from '@/helper/image'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: vi.fn(), invoke: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn() }))
vi.mock('@/stores', () => ({ useEditorStore: { getState: () => ({ folderData: null }) } }))
vi.mock('@/helper/filesys', () => ({ FileResultCode: { Success: 0 } }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

const adapters: CapricornRuntimeAdapter[] = []
const pngPayload =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8L8AAAAASUVORK5CYII='
const png = `data:image/png;base64,${pngPayload}`
const parameterizedPng = `data:image/png;charset=UTF-8;base64,${pngPayload}`
const binaryPng = `data:application/octet-stream;base64,${pngPayload}`
const uppercasePng = `DATA:IMAGE/PNG;BASE64,${pngPayload}`
const foldedPng = `${pngPayload.slice(0, 32)}\n${pngPayload.slice(32)}`
const encodedPng = pngPayload.replaceAll('/', '%2F').replaceAll('+', '%2B').replaceAll('=', '%3D')
// Trailing bytes exercise the HTML source budget, not browser image decoding.
const largePng = `data:image/png;base64,${btoa(atob(pngPayload) + '\0'.repeat(100_000))}`

afterEach(async () => {
  await act(async () => adapters.splice(0).forEach((adapter) => adapter.destroy()))
  document.body.replaceChildren()
  vi.clearAllMocks()
})

async function mount(markdown: string, mode: 'edit' | 'preview') {
  const container = document.createElement('div')
  document.body.append(container)
  const onError = vi.fn()
  const onChange = vi.fn()
  let adapter!: CapricornRuntimeAdapter
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      onChange,
      options: {
        markdown,
        mode,
        autoFocus: false,
        virtualize: { enable: false },
        handleViewImgSrcUrl: (value) => getImageUrlInTauri(value, '/workspace/notes'),
        onError,
      },
    })
    adapters.push(adapter)
  })
  return { adapter, container, onChange, onError }
}

// Exercise the same package resolver used by Desktop, as well as source integration.
describe.skipIf(!isCapricornRuntimeAvailable)(
  'Capricorn Base64 compatibility through the Desktop host',
  () => {
    describe.each(['edit', 'preview'] as const)('%s mode', (mode) => {
      it.each([
        { name: 'standard PNG', markdown: `![image](${png})`, expected: png },
        { name: 'MIME parameters', markdown: `![image](${parameterizedPng})`, expected: png },
        { name: 'binary image', markdown: `![image](${binaryPng})`, expected: png },
        {
          name: 'binary image reference',
          markdown: `![image][embedded]\n\n[embedded]: ${binaryPng}`,
          expected: png,
        },
        {
          name: 'uppercase HTML image',
          markdown: `<div><img src="${uppercasePng}" alt="image"></div>`,
          expected: png,
        },
        {
          name: 'binary HTML image',
          markdown: `<div><img src="${binaryPng}" alt="image"></div>`,
          expected: png,
        },
        {
          name: 'folded HTML image',
          markdown: `<div><img src="data:image/png;base64,${foldedPng}" alt="image"></div>`,
          expected: png,
        },
        {
          name: 'folded binary HTML image',
          markdown: `<div><img src="data:application/octet-stream;base64,${foldedPng}" alt="image"></div>`,
          expected: png,
        },
        {
          name: 'percent-encoded image',
          markdown: `![image](data:application/octet-stream;base64,${encodedPng})`,
          expected: png,
        },
        {
          name: 'large HTML image',
          markdown: `<div><img src="${largePng}" alt="image"></div>`,
          expected: largePng,
        },
      ])('renders $name without changing the document', async ({ markdown, expected }) => {
        const host = await mount(markdown, mode)
        await waitFor(() => {
          expect(host.container.querySelector('img')?.getAttribute('src')).toBe(expected)
        })
        expect(host.adapter.getMarkdown()).toBe(markdown)
        expect(host.adapter.getUiState().canUndo).toBe(false)
        expect(host.onChange).not.toHaveBeenCalledWith(
          expect.objectContaining({ documentChanged: true }),
        )
        expect(host.onError).not.toHaveBeenCalled()
      })
    })

    it.each([parameterizedPng, binaryPng])(
      'keeps the original image address through editing, undo and reopening',
      async (src) => {
        const original = `![image](${src})`
        const host = await mount(original, 'edit')
        const edit = vi.fn<(request: CapricornInlineEditRequest | null) => void>()
        const unsubscribe = host.adapter.subscribeInlineEdit!(edit)
        try {
          await waitFor(() => expect(host.container.querySelector('img')).not.toBeNull())
          await act(async () => host.container.querySelector('img')!.click())
          const bookmark = edit.mock.lastCall?.[0]?.bookmark
          expect(bookmark?.image?.src).toBe(src)
          if (!bookmark?.image) throw new Error('The image edit bookmark is missing.')
          const image = bookmark.image
          expect(host.adapter.selection?.restore(bookmark.id)).toBe(true)
          await act(async () =>
            host.adapter.commands.updateImage!(image.key, { alt: 'updated' }),
          )
          const saved = `![updated](${src})`
          expect(host.adapter.getMarkdown()).toBe(saved)
          await act(async () => host.adapter.commands.undo())
          expect(host.adapter.getMarkdown()).toBe(original)
          await act(async () => host.adapter.commands.redo())
          expect(host.adapter.getMarkdown()).toBe(saved)
          const reopened = await mount(host.adapter.getMarkdown(), 'preview')
          await waitFor(() =>
            expect(reopened.container.querySelector('img')?.getAttribute('src')).toBe(png),
          )
          expect(reopened.adapter.getMarkdown()).toBe(saved)
          expect(reopened.adapter.getUiState().canUndo).toBe(false)
          expect(host.onError).not.toHaveBeenCalled()
          expect(reopened.onError).not.toHaveBeenCalled()
        } finally {
          unsubscribe()
        }
      },
    )

    it('uses the runtime payload check after the host image form accepts binary metadata', async () => {
      const host = await mount('', 'edit')
      const source = normalizeInlineAddress(binaryPng, 'image')!
      await act(async () => host.adapter.commands.insertImage({ src: source, alt: 'image' }))
      await waitFor(() => {
        expect(host.container.querySelector('img')?.getAttribute('src')).toBe(png)
      })
      expect(host.adapter.getMarkdown()).toContain(binaryPng)

      const unsupported = normalizeInlineAddress(
        `data:application/octet-stream;base64,${btoa('<svg/>')}`,
        'image',
      )!
      expect(() => host.adapter.commands.insertImage({ src: unsupported })).toThrow()
      expect(host.adapter.getMarkdown()).not.toContain(unsupported)
    })
  },
)
