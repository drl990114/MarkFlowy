import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { capricornRuntimeVersion } from '@/constants/capricornRuntime'
import {
  createCapricornRuntimeAdapter,
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

// These contracts require the pending Capricorn source changes. The installed
// 0.5.9 package remains covered separately by the published integration suite.
describe.skipIf(capricornRuntimeVersion !== 'source-integration')(
  'Capricorn Base64 compatibility through the Desktop host',
  () => {
    describe.each(['edit', 'preview'] as const)('%s mode', (mode) => {
      it.each([
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
