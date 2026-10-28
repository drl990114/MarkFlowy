import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { getImageUrlInTauri } from '@/helper/image'

const native = vi.hoisted(() => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
  invoke: vi.fn(async () => true),
  join: vi.fn(async (directory: string, path: string) => `${directory}/${path}`),
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: native.convertFileSrc,
  invoke: native.invoke,
}))
vi.mock('@tauri-apps/api/path', () => ({ join: native.join }))
vi.mock('@/stores', () => ({ useEditorStore: { getState: () => ({ folderData: null }) } }))
vi.mock('@/helper/filesys', () => ({ FileResultCode: { Success: 0 } }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

const adapters: CapricornRuntimeAdapter[] = []
const source = [
  '<p align="center">',
  '  <img src="assets/imgs/DQN.png" width="500" alt="DQN" />',
  '</p>',
  '<p align="center"><em>Figure 2-2: Deep Q-Network (DQN)</em></p>',
].join('\n')

afterEach(async () => {
  await act(async () => adapters.splice(0).forEach((adapter) => adapter.destroy()))
  document.body.replaceChildren()
  vi.clearAllMocks()
})

async function mount(
  markdown: string,
  directory: string,
  mode: 'edit' | 'preview' = 'edit',
  imageResolver?: (value: string) => Promise<string> | string,
) {
  const container = document.createElement('div')
  document.body.append(container)
  const resolveImage = vi.fn(
    imageResolver ?? ((value: string) => getImageUrlInTauri(value, directory)),
  )
  const onChange = vi.fn()
  const onError = vi.fn()
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
        handleViewImgSrcUrl: resolveImage,
        onError,
      },
    })
    adapters.push(adapter)
  })
  return { adapter, container, onChange, onError, resolveImage }
}

describe('Capricorn HTML image host integration', () => {
  const pngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8L8AAAAASUVORK5CYII='
  const base64Images = [
    { name: 'Markdown', markdown: `![Base64 image](${pngDataUrl})` },
    {
      name: 'reference Markdown',
      markdown: `![Base64 image][embedded]\n\n[embedded]: ${pngDataUrl}`,
    },
    { name: 'HTML image', markdown: `<img src="${pngDataUrl}" alt="Base64 image">` },
    {
      name: 'nested HTML image',
      markdown: `<div><img src="${pngDataUrl}" alt="Base64 image"></div>`,
    },
  ]

  describe.each(['edit', 'preview'] as const)('Base64 images in %s mode', (mode) => {
    it.each(base64Images)('preserves the embedded source in $name', async ({ markdown }) => {
      const host = await mount(markdown, '/workspace/notes', mode)

      await waitFor(() => {
        const image = host.container.querySelector('img')
        expect(image?.getAttribute('src')).toBe(pngDataUrl)
        expect(image?.getAttribute('alt')).toBe('Base64 image')
      })

      expect(native.invoke).not.toHaveBeenCalled()
      expect(native.join).not.toHaveBeenCalled()
      expect(native.convertFileSrc).not.toHaveBeenCalled()
      expect(host.adapter.getMarkdown()).toBe(markdown)
      expect(host.adapter.getUiState().canUndo).toBe(false)
      expect(host.onChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ documentChanged: true }),
      )
      expect(host.onError).not.toHaveBeenCalled()
    })
  })

  it('shows surrounding HTML while an image resolver is still pending', async () => {
    let resolve!: (value: string) => void
    const pending = new Promise<string>((done) => {
      resolve = done
    })
    const host = await mount(source, '/workspace/notes', 'preview', () => pending)
    await waitFor(() => {
      expect(host.resolveImage).toHaveBeenCalledWith('assets/imgs/DQN.png')
      expect(host.container.querySelector('.capricorn-html-preview-content em')?.textContent).toBe(
        'Figure 2-2: Deep Q-Network (DQN)',
      )
    })
    expect(
      host.container.querySelector('.capricorn-html-preview-content img')?.getAttribute('src'),
    ).toBeNull()
    await act(async () => resolve('asset://localhost/resolved.png'))
    await waitFor(() => {
      expect(
        host.container.querySelector('.capricorn-html-preview-content img')?.getAttribute('src'),
      ).toBe('asset://localhost/resolved.png')
    })
    expect(host.adapter.getMarkdown()).toBe(source)
  })

  it.each(['edit', 'preview'] as const)(
    'resolves the issue #1244 image relative to its document in %s mode',
    async (mode) => {
      const host = await mount(source, '/workspace/notes', mode)
      await waitFor(() => {
        const image = host.container.querySelector('.capricorn-html-preview-content img')
        expect(image?.getAttribute('src')).toBe(
          'asset://localhost/%2Fworkspace%2Fnotes%2Fassets%2Fimgs%2FDQN.png',
        )
        expect(image?.getAttribute('width')).toBe('500')
        expect(image?.getAttribute('alt')).toBe('DQN')
      })
      expect(host.resolveImage).toHaveBeenCalledWith('assets/imgs/DQN.png')
      expect(native.invoke).toHaveBeenCalledWith('file_exists', {
        filePath: '/workspace/notes/assets/imgs/DQN.png',
      })
      expect(host.container.querySelector('.capricorn-html-preview-content em')?.textContent).toBe(
        'Figure 2-2: Deep Q-Network (DQN)',
      )
      expect(host.adapter.getMarkdown()).toBe(source)
      expect(host.adapter.getUiState().canUndo).toBe(false)
      expect(host.onChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ documentChanged: true }),
      )
      expect(host.onError).not.toHaveBeenCalled()
    },
  )

  it('keeps cached HTML image paths scoped to each document', async () => {
    const first = await mount(source, '/workspace/first', 'preview')
    await waitFor(() => expect(first.resolveImage).toHaveBeenCalled())
    const second = await mount(source, '/workspace/second', 'preview')
    await waitFor(() => {
      expect(
        first.container.querySelector('.capricorn-html-preview-content img')?.getAttribute('src'),
      ).toBe('asset://localhost/%2Fworkspace%2Ffirst%2Fassets%2Fimgs%2FDQN.png')
      expect(
        second.container.querySelector('.capricorn-html-preview-content img')?.getAttribute('src'),
      ).toBe('asset://localhost/%2Fworkspace%2Fsecond%2Fassets%2Fimgs%2FDQN.png')
    })
    expect(second.resolveImage).toHaveBeenCalledWith('assets/imgs/DQN.png')
    expect(first.adapter.getMarkdown()).toBe(source)
    expect(second.adapter.getMarkdown()).toBe(source)
  })
})
